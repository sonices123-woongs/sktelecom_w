const SALES_OWNER = 'sonices123@gmail.com';
const SALES_DB = 'https://sktelecom-w-default-rtdb.asia-southeast1.firebasedatabase.app';
const SALES_TAB = '판매원본';
// 선택한 열만 전송합니다. 고객 이름/전화번호 등 원본의 나머지 열은 전송하지 않습니다.
const SALES_HEADERS=['개통일','개통시간','단말기정보_단말기','개통정보_세부판매유형','개통정보_유통망','단말기정보_단말기결제조건','요금제','단말할부금','공통지원금','추가지원금','제휴카드선할인','레벨2조직명','정산처','정산매장코드'];
const SALES_COLUMNS={date:1,time:2,model:3,activation:4,contract:5,payment:6,plan:7,installment:8,subsidy:9,extra:10,card:11,staff:12,seller:13};
function onOpen(){SpreadsheetApp.getUi().createMenu('SKW 자료 연동').addItem('판매 자동 반영 설정','setupSalesSync').addItem('판매 지금 반영','syncSalesNow').addItem('재고 자동 반영 설정','setupInventorySync').addItem('재고 지금 반영','syncInventoryNow').addItem('공통지원금 지금 반영','syncCommonSubsidyNow').addToUi()}
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
function salesEdited(e){if(!e?.range)return;const name=e.range.getSheet().getName();if(name===SALES_TAB){syncSalesNow();syncCommonSubsidyNow()}else if(name===INVENTORY_TAB)syncInventoryNow();else if(name==='공통지원금')syncCommonSubsidyNow()}
function salesChanged(e){if(e&&e.changeType!=='EDIT'&&e.changeType!=='FORMAT'){const errors=[];for(const fn of [syncSalesNow,syncInventoryNow,syncCommonSubsidyNow])try{fn()}catch(error){errors.push(error.message)}if(errors.length)throw new Error(errors.join(' / '))}}
function salesColumn_(v){return String(v==null?'':v).trim()}
function buildSalesPayload_(values,display,timezone){
 if(values.length<2)throw new Error('원본이 비어 있어 기존 판매 자료를 유지했습니다. 제목과 판매 데이터를 붙여넣어주세요.');
 const hasRepresentative=salesColumn_(display[0][2])==='대표모델명';
 const expected=hasRepresentative?[...SALES_HEADERS.slice(0,2),'대표모델명',...SALES_HEADERS.slice(2)]:SALES_HEADERS;
 if(!expected.every((name,j)=>salesColumn_(display[0][j])===name))throw new Error('판매원본 제목 및 순서를 확인해주세요. 대표모델명은 C열에 입력할 수 있습니다.');
 const now=Date.now(),all={updatedAt:now,rows:{}},byStore={};let count=0;
 for(let i=1;i<values.length;i++){
  const v=values[i],d=display[i];if(!d.some(x=>salesColumn_(x)))continue;
  const saleDate=salesColumn_(d[0]);
  if(!saleDate||saleDate==='0')continue;
  if(d.some(x=>['#REF!','#VALUE!','#N/A','#NAME?','#DIV/0!','#NUM!','#SPILL!'].some(error=>salesColumn_(x).startsWith(error))))throw new Error((i+1)+'행에 수식 오류가 있습니다. 기존 자료를 유지했습니다.');
  const code=salesColumn_(d[hasRepresentative?14:13]).toUpperCase();
  if(!/^[PD][A-Z0-9]{5,20}$/.test(code))throw new Error((i+1)+'행 정산매장코드를 확인해주세요. 기존 자료를 유지했습니다.');
  const row={storeCode:code,saleType:salesColumn_(d[hasRepresentative?4:3]),representativeModel:hasRepresentative?salesColumn_(d[2]):salesColumn_(d[2])};
  for(const key in SALES_COLUMNS){const j=SALES_COLUMNS[key]-1+(hasRepresentative&&SALES_COLUMNS[key]>=3?1:0);row[key]=salesColumn_(d[j]);if(['installment','subsidy','extra','card'].includes(key)&&typeof v[j]==='number')row[key]=v[j];}
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
  if(sheet.getLastColumn()<14)throw new Error('정산매장코드까지 붙여넣어주세요.');
  const range=sheet.getRange(1,1,sheet.getLastRow(),sheet.getRange('C1').getDisplayValue()==='대표모델명'?15:14),payload=buildSalesPayload_(range.getValues(),range.getDisplayValues(),book.getSpreadsheetTimeZone());
  console.log('3/5 Firebase에 판매 '+Object.keys(payload.all.rows).length+'건 전송');
  const response=UrlFetchApp.fetch(SALES_DB+'/sales.json',{method:'put',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify(payload),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Firebase 반영 실패 ('+response.getResponseCode()+'). 연결 프로젝트와 소유자 권한을 확인해주세요.');
  console.log('판매 '+Object.keys(payload.all.rows).length+'건 반영 완료');
 }finally{lock.releaseLock()}
}

const INVENTORY_TAB='재고관리';
function cleanStock_(v){const text=String(v==null?'':v).trim();return ['0','None','null','undefined'].includes(text)?'':text}
function buildInventoryPayload_(values,display,timezone){
 if(values.length<2)throw new Error('재고관리 탭이 비어 있어 기존 재고를 유지했습니다.');
 const expected=['레벨2조직명','레벨3조직명','보유처','재고이동입고일자','대표모델명','색상','일련번호','비고'];
 if(!expected.every((name,i)=>String(display[0][i]).trim()===name))throw new Error('재고관리 A1:H1 제목이 업로드용과 다릅니다. 제목 포함 A~H열을 붙여넣어주세요.');
 const rows={};
 for(let i=1;i<display.length;i++){
  const d=display[i],modelName=cleanStock_(d[4]);if(!modelName)continue;
  if(d.some(v=>/^#(REF!|VALUE!|N\/A|NAME\?|DIV\/0!|NUM!|SPILL!)/.test(String(v))))throw new Error((i+1)+'행에 수식 오류가 있습니다. 기존 재고를 유지했습니다.');
  let moveDate=cleanStock_(d[3]);
  if(values[i][3] instanceof Date)moveDate=Utilities.formatDate(values[i][3],timezone,'yyyy-MM-dd');
  else {const match=moveDate.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);moveDate=match?match[1]+'-'+match[2].padStart(2,'0')+'-'+match[3].padStart(2,'0'):''}
  if(moveDate==='1899-12-30')moveDate='';
  rows['r'+String(i).padStart(7,'0')]={manager:cleanStock_(d[0]),region:cleanStock_(d[1]),location:cleanStock_(d[2]),moveDate,modelName,color:cleanStock_(d[5]),serialNo:cleanStock_(d[6]),note:cleanStock_(d[7])};
 }
 const count=Object.keys(rows).length;if(!count)throw new Error('재고가 0건이어서 기존 재고를 유지했습니다.');
 return {updatedAt:Date.now(),count,rows};
}
function setupInventorySync(){
 requireSalesOwner_();const book=SpreadsheetApp.getActiveSpreadsheet();
 if(!book.getSheetByName(INVENTORY_TAB))throw new Error('재고관리 탭을 만들어 업로드용을 붙여넣어주세요.');
 PropertiesService.getScriptProperties().setProperty('SALES_SHEET_ID',book.getId());
 syncInventoryNow();
 const names=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
 if(!names.includes('salesEdited'))ScriptApp.newTrigger('salesEdited').forSpreadsheet(book).onEdit().create();
 if(!names.includes('salesChanged'))ScriptApp.newTrigger('salesChanged').forSpreadsheet(book).onChange().create();
 console.log('재고 자동 반영 설정 완료. 판매원본과 재고관리는 각각 별도로 반영됩니다.');
}
function syncInventoryNow(){
 requireSalesOwner_();console.log('재고관리 읽기 시작');const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw new Error('다른 자료 반영이 진행 중입니다. 잠시 후 다시 실행해주세요.');
 try{
  const id=PropertiesService.getScriptProperties().getProperty('SALES_SHEET_ID'),book=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet(),sheet=book.getSheetByName(INVENTORY_TAB);
  if(!sheet)throw new Error('재고관리 탭이 없습니다.');
  const range=sheet.getRange(1,1,Math.max(1,sheet.getLastRow()),8),payload=buildInventoryPayload_(range.getValues(),range.getDisplayValues(),book.getSpreadsheetTimeZone());
  console.log('재고 '+payload.count+'건 Firebase 전송');
  const result=UrlFetchApp.fetch(SALES_DB+'/inventory.json',{method:'put',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify(payload),muteHttpExceptions:true});
  if(result.getResponseCode()!==200)throw new Error('재고 반영 실패 ('+result.getResponseCode()+'). 소유자 권한과 프로젝트 연결을 확인해주세요.');
  console.log('재고 '+payload.count+'건 반영 완료');
 }finally{lock.releaseLock()}
}

function normalizePolicyName_(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,'')}
function syncCommonSubsidyNow(){
 requireSalesOwner_();
 const id=PropertiesService.getScriptProperties().getProperty('SALES_SHEET_ID');
 const book=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
 const sheet=book.getSheetByName('공통지원금');
 if(!sheet)throw new Error('공통지원금 시트를 찾을 수 없습니다.');
 const data=sheet.getDataRange().getDisplayValues();
 if(data.length<3||data[0].length<4)throw new Error('공통지원금 시트의 2단 헤더와 데이터를 확인해주세요.');
 const plans=[],columns=[];
 for(let c=1;c+2<data[0].length;c+=3){
  const name=String(data[0][c]||'').trim().replace(/\n/g,' ');
  if(!name)continue;
  if(!['010','MNP','기변'].every((v,j)=>{const cell=String(data[1][c+j]||'').trim();return j===0?(cell==='010'||cell==='10'):cell===v}))throw new Error('공통지원금 '+(c+1)+'열의 010/MNP/기변 헤더를 확인해주세요.');
  plans.push(name);columns.push(c);
 }
 if(!plans.length)throw new Error('요금제 헤더가 없습니다.');
 const models={};
 for(let i=2;i<data.length;i++){
  const model=String(data[i][0]||'').trim();if(!model||model==='0')continue;
  const amounts=columns.map(c=>[0,1,2].map(j=>{const t=String(data[i][c+j]||'').replace(/[,원\s]/g,'');return /^-?\d+(?:\.\d+)?$/.test(t)?Number(t):null}));
  models[model]=amounts;
 }
 const sales=book.getSheetByName(SALES_TAB);
 if(!sales)throw new Error('판매원본 시트가 없습니다.');
 const values=sales.getDataRange().getDisplayValues();
 const now=Utilities.formatDate(new Date(),book.getSpreadsheetTimeZone(),'yyyy-MM');
 const stats={};
 for(let i=1;i<values.length;i++){
  const row=values[i],hasRep=String(values[0][2]||'').trim()==='대표모델명',date=String(row[0]||'').replace(/[./]/g,'-');
  if(!date.startsWith(now)||!String(row[hasRep?5:4]||'').trim()==='T지원금약정')continue;
  const model=String(row[2]||'').trim(),plan=String(row[hasRep?7:6]||'').trim();
  if(!model)continue;
  if(!stats[model])stats[model]={count:0,plans:{}};
  stats[model].count++;
  stats[model].plans[plan]=(stats[model].plans[plan]||0)+1;
 }
 const top=Object.entries(stats).sort((a,b)=>b[1].count-a[1].count||a[0].localeCompare(b[0])).slice(0,5).map(([model,v])=>({model,count:v.count,plan:Object.entries(v.plans).sort((a,b)=>b[1]-a[1])[0]?.[0]||''}));
 const payload={updatedAt:Date.now(),month:now,plans,models,top};
 const response=UrlFetchApp.fetch(SALES_DB+'/publicPolicy/commonSubsidy.json',{method:'put',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify(payload),muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('공통지원금 Firebase 반영 실패 ('+response.getResponseCode()+')');
 console.log('공통지원금 '+Object.keys(models).length+'개 모델, 이번 달 TOP '+top.length+'건 반영 완료');
}
