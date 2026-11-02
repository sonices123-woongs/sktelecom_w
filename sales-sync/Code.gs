const SALES_OWNER = 'sonices123@gmail.com';
const SALES_DB = 'https://sktelecom-w-default-rtdb.asia-southeast1.firebasedatabase.app';
const SALES_TAB = '판매원본';
// 선택한 열만 전송합니다. 고객 이름/전화번호 등 원본의 나머지 열은 전송하지 않습니다.
const SALES_COLUMNS = {date:1,time:2,activation:14,contract:15,payment:19,model:22,color:23,serial:24,plan:28,price:46,installment:49,subsidy:54,extra:56,discount:59,staff:81,seller:89};
function onOpen(){SpreadsheetApp.getUi().createMenu('SKW 판매 연동').addItem('처음 연결 / 자동 반영 켜기','setupSalesSync').addItem('지금 반영','syncSalesNow').addToUi()}
function requireSalesOwner_(){if(Session.getEffectiveUser().getEmail().toLowerCase()!==SALES_OWNER)throw new Error('소유자 계정에서 실행해주세요.')}
function setupSalesSync(){
 console.log('1/5 소유자 및 시트 확인');
 requireSalesOwner_();const sheet=SpreadsheetApp.getActiveSpreadsheet();
 if(!sheet.getSheetByName(SALES_TAB))throw new Error('판매원본 탭을 만들어 원본을 붙여넣어주세요.');
 PropertiesService.getScriptProperties().setProperty('SALES_SHEET_ID',sheet.getId());
 syncSalesNow();
 console.log('4/5 자동 반영 트리거 설정');
 for(const trigger of ScriptApp.getProjectTriggers())if(['salesEdited','salesChanged'].includes(trigger.getHandlerFunction()))ScriptApp.deleteTrigger(trigger);
 ScriptApp.newTrigger('salesEdited').forSpreadsheet(sheet).onEdit().create();
 ScriptApp.newTrigger('salesChanged').forSpreadsheet(sheet).onChange().create();
 console.log('5/5 연결 완료! 판매원본에 붙여넣으면 자동 반영됩니다.');
}
function salesEdited(e){if(e&&e.range&&e.range.getSheet().getName()===SALES_TAB)syncSalesNow()}
function salesChanged(e){if(e&&e.changeType!=='EDIT'&&e.changeType!=='FORMAT')syncSalesNow()}
function salesColumn_(v){return String(v==null?'':v).trim()}
function buildSalesPayload_(values,display,timezone){
 if(values.length<2)throw new Error('원본이 비어 있어 기존 판매 자료를 유지했습니다. 제목과 판매 데이터를 붙여넣어주세요.');
 if(!/개통일/.test(salesColumn_(display[0][0]))||!/코드/.test(salesColumn_(display[0][10])))throw new Error('원본 열 위치가 다릅니다. A열 개통일, K열 판매매장코드를 확인해주세요.');
 const now=Date.now(),all={updatedAt:now,rows:{}},byStore={};let count=0;
 for(let i=1;i<values.length;i++){
  const v=values[i],d=display[i];if(!d.some(x=>salesColumn_(x)))continue;
  const code=salesColumn_(d[10]).toUpperCase();
  if(!/^[PD][A-Z0-9]{5,20}$/.test(code))throw new Error((i+1)+'행 K열 판매매장코드를 확인해주세요. 기존 자료를 유지했습니다.');
  const row={storeCode:code,saleType:salesColumn_(d[7])};
  for(const key in SALES_COLUMNS){const j=SALES_COLUMNS[key]-1;row[key]=salesColumn_(d[j]);if(['price','installment','subsidy','extra','discount'].includes(key)&&typeof v[j]==='number')row[key]=v[j];}
  if(v[0] instanceof Date)row.date=Utilities.formatDate(v[0],timezone,'yyyy-MM-dd');
  else {const match=row.date.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);if(match)row.date=match[1]+'-'+match[2].padStart(2,'0')+'-'+match[3].padStart(2,'0');}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date))throw new Error((i+1)+'행 개통일 형식을 확인해주세요.');
  if(v[1] instanceof Date)row.time=Utilities.formatDate(v[1],timezone,'HH:mm');
  else {const match=row.time.match(/^(\d{1,2}):(\d{2})/);if(!match)throw new Error((i+1)+'행 개통시간 형식을 확인해주세요.');row.time=match[1].padStart(2,'0')+':'+match[2];}
  const id='r'+String(i).padStart(7,'0');all.rows[id]=row;count++;
  if(/^P[A-Z0-9]{5}$/.test(code)){if(!byStore[code])byStore[code]={updatedAt:now,rows:{}};byStore[code].rows[id]=row;}
 }
 if(!count)throw new Error('판매가 0건이어서 기존 자료를 유지했습니다.');
 return {all,byStore};
}
function syncSalesNow(){
 requireSalesOwner_();console.log('2/5 판매 원본 읽기');const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw new Error('다른 판매 반영이 진행 중입니다. 잠시 후 다시 실행해주세요.');
 try{
  const id=PropertiesService.getScriptProperties().getProperty('SALES_SHEET_ID');
  const book=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet(),sheet=book.getSheetByName(SALES_TAB);
  if(!sheet)throw new Error('판매원본 탭이 없습니다.');
  if(sheet.getLastColumn()<89)throw new Error('CK열까지 원본을 붙여넣어주세요.');
  const range=sheet.getRange(1,1,sheet.getLastRow(),89),payload=buildSalesPayload_(range.getValues(),range.getDisplayValues(),book.getSpreadsheetTimeZone());
  console.log('3/5 Firebase에 판매 '+Object.keys(payload.all.rows).length+'건 전송');
  const response=UrlFetchApp.fetch(SALES_DB+'/sales.json',{method:'put',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify(payload),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Firebase 반영 실패 ('+response.getResponseCode()+'). 연결 프로젝트와 소유자 권한을 확인해주세요.');
  console.log('판매 '+Object.keys(payload.all.rows).length+'건 반영 완료');
 }finally{lock.releaseLock()}
}
