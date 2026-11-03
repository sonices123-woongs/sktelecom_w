export function salesScope(user,access,owner=false){
 if(owner)return 'all';
 if(!access?.active||access?.permissions?.sales!==true)return null;
 const email=(user?.email||'').toLowerCase();
 if(!email.endsWith('@accounts.skw.invalid'))return null;
 const id=email.split('@')[0];
 if(id.startsWith('d33654'))return 'all';
 const code=id.slice(0,6).toUpperCase();
 return /^P[A-Z0-9]{5}$/.test(code)?'byStore/'+code:null;
}
export const columns=[['date','개통일'],['time','시간'],['model','모델명'],['activation','개통정보'],['contract','약정정보'],['payment','할부'],['plan','요금제'],['installment','단말기할부금'],['subsidy','공통지원금'],['extra','추가지원금'],['card','제휴카드'],['staff','담당'],['seller','판매처']];
export const staffOrder=['이준모','박정우','하성수','김진성','이민호','우재용','직영','소사','박민수','맥스','범고래','신동준'];
export function staffSort(a,b){const ai=staffOrder.indexOf(a),bi=staffOrder.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'ko')}
function includesChoice(choice,value){return !choice||(Array.isArray(choice)?!choice.length||choice.includes(value):choice===value)}
export function filterSales(rows,f){return rows.filter(r=>includesChoice(f.date,r.date)&&includesChoice(f.staff,r.staff)&&includesChoice(f.seller,r.seller)&&((f.model||'').trim().length<3||String(r.model||'').toLowerCase().includes(f.model.trim().toLowerCase())))}
export function sellerOptions(rows,staff){return [...new Set(rows.filter(r=>includesChoice(staff,r.staff)).map(r=>r.seller).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))}
export function mountSales(root,{user,access,owner,db,dbApi}){
 const scope=salesScope(user,access,owner),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 if(!scope){root.append(el('p','판매 조회 권한 또는 판매점 코드를 확인해주세요.'));return ()=>{}}
 const controls=el('div');controls.className='salesfilters';const f={date:[],staff:[],seller:[],model:''},inputs={};
 const status=el('p','판매 자료를 불러오는 중…');status.setAttribute('role','status');
 const wrap=el('div');wrap.className='salestable';const pager=el('div');pager.className='editcontrols';
 let rows=[],page=1,dead=false;
 let activeDialog=null;
 const filterValues={date:[],staff:[],seller:[]};
 const basisNodes=[...document.querySelectorAll('.mobilepagebar,.workspacehead .sectiontop')].map(parent=>{const n=el('span');n.className='salesbasis';parent.append(n);return n});
 function summary(key){const n=inputs[key];if(!n)return;const picked=f[key],label={date:'날짜',staff:'담당',seller:'판매처'}[key];n.textContent=!picked.length?label+' 전체':picked.length===1?picked[0]:picked[0]+' 외 '+(picked.length-1);n.title=picked.join(', ')||'전체'}
 function openChoices(key,label){
  activeDialog?.remove();const dialog=el('dialog');activeDialog=dialog;dialog.className='salesfilterdialog';const title=el('h2',label+' 선택');const list=el('div');list.className='salesfilterlist';dialog.append(title,list);
  function redraw(){list.replaceChildren();for(const [value,text] of [['','전체'],...filterValues[key].map(v=>[v,v])]){const l=el('label'),check=el('input');check.type='checkbox';check.checked=value?f[key].includes(value):!f[key].length;check.onchange=()=>{if(!value)f[key]=[];else if(check.checked)f[key]=[...f[key],value];else f[key]=f[key].filter(v=>v!==value);if(key==='staff')choices('seller','seller',sellerOptions(rows,f.staff));summary(key);page=1;paint();redraw()};l.append(check,document.createTextNode(text));list.append(l)}}
  redraw();const done=el('button','선택 완료');done.className='quiet';done.onclick=()=>dialog.close();dialog.append(done);dialog.onclose=()=>{dialog.remove();if(activeDialog===dialog)activeDialog=null};document.body.append(dialog);dialog.showModal();
 }
 function field(key,label,type){const l=el('label'),n=el(type==='select'?'button':'input');l.setAttribute('aria-label',label);if(type==='select'){n.type='button';n.className='salesselect';n.setAttribute('aria-label',label+' 다중 선택');n.setAttribute('aria-haspopup','dialog');n.onclick=()=>openChoices(key,label);n.textContent=label+' 전체'}else{n.type=type;n.oninput=()=>{f[key]=n.value;page=1;paint()}}l.append(n);controls.append(l);inputs[key]=n;return n}
 field('date','날짜','select');field('staff','담당','select');field('seller','판매처','select');
 const searchline=el('div');searchline.className='salessearchline';const model=field('model','모델명','search');model.setAttribute('aria-label','모델명 검색');model.placeholder='모델명 3자 이상 검색';model.autocomplete='off';searchline.append(model.parentElement);
 const reset=el('button','필터 초기화');reset.className='quiet salesreset';reset.onclick=()=>{for(const key of ['date','staff','seller']){f[key]=[];summary(key)}f.model='';inputs.model.value='';choices('seller','seller',sellerOptions(rows,''));page=1;paint()};searchline.append(reset);
 root.append(controls,searchline,status,wrap,pager);
 function choices(key,prop,values){filterValues[key]=values||[...new Set(rows.map(r=>r[prop]).filter(Boolean))].sort((a,b)=>key==='date'?b.localeCompare(a):key==='staff'?staffSort(a,b):a.localeCompare(b,'ko'));f[key]=f[key].filter(value=>filterValues[key].includes(value));summary(key)}
 let updatedAt=0,loaded=false;
 function paint(){
  if(dead)return;const filtered=f.date.length>0||f.staff.length>0||f.seller.length>0||f.model.trim().length>=3,pageSize=filtered?50:30;const selected=filterSales(rows,f),pages=Math.max(1,Math.ceil(selected.length/pageSize));page=Math.min(page,pages);
  const latest=rows.reduce((last,r)=>r.date>last?r.date:last,'');for(const n of basisNodes)n.textContent=latest?'개통일('+latest+') 기준입니다.':'';status.textContent=loaded?'조회 '+selected.length.toLocaleString()+'건':'판매 자료를 불러오는 중…';
  wrap.replaceChildren();pager.replaceChildren();
  if(!selected.length){wrap.append(el('p',rows.length?'조건에 맞는 판매가 없습니다.':'아직 반영된 판매 자료가 없습니다.'));return}
  const table=el('table'),caption=el('caption','판매현황'),head=el('thead'),tr=el('tr'),body=el('tbody');caption.className='sr-only';const numberHead=el('th','순번');numberHead.scope='col';numberHead.dataset.column='number';tr.append(numberHead);for(const [key,label] of columns){const th=el('th',label);th.scope='col';th.dataset.column=key;tr.append(th)}head.append(tr);
  let number=filtered?(page-1)*pageSize:0;for(const row of selected.slice(filtered?(page-1)*pageSize:0,filtered?page*pageSize:30)){const line=el('tr'),numberCell=el('td',++number);numberCell.dataset.column='number';line.append(numberCell);for(const [key] of columns){let value=row[key]??'';if(key==='date')value=String(value).slice(5);if(['price','installment','subsidy','extra','discount'].includes(key)&&typeof value==='number')value=value.toLocaleString('ko-KR');const td=el('td',value);td.dataset.column=key;td.title=String(value);line.append(td)}body.append(line)}
  table.append(caption,head,body);wrap.append(table);if(!filtered){if(selected.length>30){const hint=el('p','처음 30건만 표시합니다. 검색·필터로 전체 자료를 조회하세요.');hint.className='initialhint';pager.append(hint)}return}
  for(const [label,step] of [['← 이전',-1],['다음 →',1]]){const b=el('button',label);b.className='quiet';b.disabled=step<0?page===1:page===pages;b.onclick=()=>{page+=step;paint()};pager.append(b);if(step<0)pager.append(el('span',page+' / '+pages))}
 }
 if(!db||!dbApi){status.textContent='판매 데이터 연결을 준비하고 있습니다. 잠시 후 판매 메뉴를 다시 열어주세요.';return ()=>{dead=true;activeDialog?.remove();basisNodes.forEach(n=>n.remove())}}
 const stop=dbApi.onValue(dbApi.ref(db,'sales/'+scope),snap=>{if(dead)return;const data=snap.val();rows=Object.values(data?.rows||{}).sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));updatedAt=data?.updatedAt||0;loaded=true;choices('date','date');choices('staff','staff');choices('seller','seller',sellerOptions(rows,f.staff));paint()},()=>{if(dead)return;rows=[];wrap.replaceChildren();pager.replaceChildren();status.textContent='판매 자료를 읽지 못했습니다. 관리자에게 판매 권한과 판매 데이터 보안 규칙을 확인해주세요.'});
 return ()=>{dead=true;rows=[];activeDialog?.remove();basisNodes.forEach(n=>n.remove());stop();wrap.replaceChildren()};
}
