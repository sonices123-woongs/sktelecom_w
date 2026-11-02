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
export function filterSales(rows,f){return rows.filter(r=>(!f.date||r.date===f.date)&&(!f.staff||r.staff===f.staff)&&(!f.seller||r.seller===f.seller)&&((f.model||'').trim().length<3||String(r.model||'').toLowerCase().includes(f.model.trim().toLowerCase())))}
export function sellerOptions(rows,staff){return [...new Set(rows.filter(r=>!staff||r.staff===staff).map(r=>r.seller).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))}
export function mountSales(root,{user,access,owner,db,dbApi}){
 const scope=salesScope(user,access,owner),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 if(!scope){root.append(el('p','판매 조회 권한 또는 판매점 코드를 확인해주세요.'));return ()=>{}}
 const controls=el('div');controls.className='salesfilters';const f={date:'',staff:'',seller:'',model:''},inputs={};
 const status=el('p','판매 자료를 불러오는 중…');status.setAttribute('role','status');
 const wrap=el('div');wrap.className='salestable';const pager=el('div');pager.className='editcontrols';
 let rows=[],page=1,dead=false;
 function field(key,label,type){const l=el('label',label),n=el(type==='select'?'select':'input');if(type!=='select')n.type=type;n.oninput=()=>{f[key]=n.value;if(key==='staff'){f.seller='';choices('seller','seller',sellerOptions(rows,f.staff))}page=1;paint()};l.append(n);controls.append(l);inputs[key]=n;return n}
 field('date','날짜','select');field('staff','담당','select');field('seller','판매처','select');
 const searchline=el('div');searchline.className='salessearchline';const model=field('model','모델명','search');model.placeholder='3자 이상 입력';model.autocomplete='off';searchline.append(model.parentElement);
 const reset=el('button','필터 초기화');reset.className='quiet salesreset';reset.onclick=()=>{for(const key of Object.keys(f)){f[key]='';if(inputs[key])inputs[key].value=''}choices('seller','seller',sellerOptions(rows,''));page=1;paint()};searchline.append(reset);
 root.append(controls,searchline,status,wrap,pager);
 function choices(key,prop,values){const n=inputs[key];if(!n)return;n.replaceChildren();const all=el('option','전체');all.value='';n.append(all);for(const v of (values||[...new Set(rows.map(r=>r[prop]).filter(Boolean))].sort((a,b)=>key==='date'?b.localeCompare(a):a.localeCompare(b,'ko')))){const o=el('option',v);o.value=v;n.append(o)}if(![...n.options].some(o=>o.value===f[key]))f[key]='';n.value=f[key]}
 let updatedAt=0,loaded=false;
 function paint(){
  if(dead)return;const selected=filterSales(rows,f),pages=Math.max(1,Math.ceil(selected.length/50));page=Math.min(page,pages);
  const latest=rows.reduce((last,r)=>r.date>last?r.date:last,'');status.textContent=loaded?(latest?'개통일('+latest+')기준 자료입니다.':'개통일 기준 자료입니다.'):'판매 자료를 불러오는 중…';
  wrap.replaceChildren();pager.replaceChildren();
  if(!selected.length){wrap.append(el('p',rows.length?'조건에 맞는 판매가 없습니다.':'아직 반영된 판매 자료가 없습니다.'));return}
  const table=el('table'),caption=el('caption','판매현황'),head=el('thead'),tr=el('tr'),body=el('tbody');caption.className='sr-only';for(const [,label] of columns){const th=el('th',label);th.scope='col';th.dataset.column=columns[tr.children.length][0];tr.append(th)}head.append(tr);
  for(const row of selected.slice((page-1)*50,page*50)){const line=el('tr');for(const [key] of columns){let value=row[key]??'';if(key==='date')value=String(value).slice(5);if(['price','installment','subsidy','extra','discount'].includes(key)&&typeof value==='number')value=value.toLocaleString('ko-KR');const td=el('td',value);td.dataset.column=key;td.title=String(value);line.append(td)}body.append(line)}
  table.append(caption,head,body);wrap.append(table);
  for(const [label,step] of [['← 이전',-1],['다음 →',1]]){const b=el('button',label);b.className='quiet';b.disabled=step<0?page===1:page===pages;b.onclick=()=>{page+=step;paint()};pager.append(b);if(step<0)pager.append(el('span',page+' / '+pages))}
 }
 if(!db||!dbApi){status.textContent='판매 데이터 연결을 준비하고 있습니다. 잠시 후 판매 메뉴를 다시 열어주세요.';return ()=>{dead=true}}
 const stop=dbApi.onValue(dbApi.ref(db,'sales/'+scope),snap=>{if(dead)return;const data=snap.val();rows=Object.values(data?.rows||{}).sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));updatedAt=data?.updatedAt||0;loaded=true;choices('date','date');choices('staff','staff');choices('seller','seller',sellerOptions(rows,f.staff));paint()},()=>{if(dead)return;rows=[];wrap.replaceChildren();pager.replaceChildren();status.textContent='판매 자료를 읽지 못했습니다. 관리자에게 판매 권한과 판매 데이터 보안 규칙을 확인해주세요.'});
 return ()=>{dead=true;rows=[];stop();wrap.replaceChildren()};
}
