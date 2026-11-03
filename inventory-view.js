import {staffSort} from './sales-sync/sales-view.js?v=20261103-dense6';
const clean=v=>String(v??'').toLowerCase().replace(/[\s_-]/g,'');
export function capacity(model){const m=String(model||'').toUpperCase().match(/(?:^|[^0-9])(1TB|1T|512GB?|256GB?|128GB?|64GB?)(?![0-9])/);return m?m[1].replace('GB','G').replace('TB','T'):'기본용량'}
export function inventoryMatch(item,query){const q=clean(query);if(!q)return true;return (q.length>=2&&clean(item.location).includes(q))||(q.length>=3&&(clean(item.modelName).includes(q)||(/^\d+$/.test(q)&&String(item.modelName).replace(/\D/g,'').includes(q))))||(q.length>=4&&clean(item.serialNo).includes(q))}
const selected=(values,value)=>!values?.length||values.includes(value);
export function filterInventory(rows,f,except=''){return rows.filter(r=>inventoryMatch(r,f.search)&&['manager','region','capacity','color'].every(key=>key===except||selected(f[key],r[key])))}
export function ageBand(date,now=new Date()){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return 0;const days=Math.floor((now-new Date(date+'T00:00:00+09:00'))/86400000);return days>=180?180:days>=90?90:0}
export function mountInventory(root,{db,dbApi,user,access,owner}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 if(!user||(!owner&&(!access?.active||access.permissions?.inventory!==true))){root.append(el('p','재고 조회 권한을 확인해주세요.'));return ()=>{}}
 let rows=[],page=1,dead=false,dialog=null,updatedAt=0,loading=true,error='';
 const f={search:'',manager:[],region:[],capacity:[],color:[],sort:'DEFAULT'},buttons={};
 const tools=el('div');tools.className='stocktools';
 const search=el('input');search.type='search';search.placeholder='보유처 2자 · 모델 3자 · 일련번호 4자';search.setAttribute('aria-label','재고 검색');search.oninput=()=>{f.search=search.value;page=1;refreshFilters();paint()};tools.append(search);
 const filters=el('div');filters.className='stockfilters';
 function values(key){return [...new Set(filterInventory(rows,f,key).map(r=>r[key]).filter(Boolean))].sort((a,b)=>key==='manager'?staffSort(a,b):a.localeCompare(b,'ko',{numeric:true}))}
 function summary(key){const v=f[key];buttons[key].textContent=v.length===0?{manager:'담당',region:'지역',capacity:'용량',color:'색상'}[key]+' 전체':v.length===1?v[0]:v[0]+' 외 '+(v.length-1)}
 function refreshFilters(){for(const key of Object.keys(buttons))summary(key)}
 function openFilter(key,label){
  dialog?.remove();const d=el('dialog');dialog=d;d.className='salesfilterdialog';d.append(el('h2',label+' 선택'));const list=el('div');list.className='salesfilterlist';d.append(list);
  function draw(){list.replaceChildren();const options=[...new Set([...values(key),...f[key]])].sort((a,b)=>key==='manager'?staffSort(a,b):a.localeCompare(b,'ko',{numeric:true}));for(const v of ['',...options]){const l=el('label'),c=el('input');c.type='checkbox';c.checked=v?f[key].includes(v):!f[key].length;c.onchange=()=>{f[key]=!v?[]:c.checked?[...f[key],v]:f[key].filter(x=>x!==v);page=1;refreshFilters();paint();draw()};l.append(c,document.createTextNode(v||'전체'));list.append(l)}}
  draw();const done=el('button','선택 완료');done.className='quiet';done.onclick=()=>d.close();d.append(done);d.onclose=()=>{d.remove();if(dialog===d)dialog=null};document.body.append(d);d.showModal();
 }
 for(const [key,label] of [['manager','담당'],['region','지역'],['capacity','용량'],['color','색상']]){const l=el('label'),b=el('button',label+' 전체');b.className='salesselect';b.type='button';b.setAttribute('aria-label',label+' 다중 선택');b.onclick=()=>openFilter(key,label);l.append(b);filters.append(l);buttons[key]=b}
 const actions=el('div');actions.className='stockactions';const sort=el('select');sort.setAttribute('aria-label','재고 정렬');for(const [v,label] of [['DEFAULT','담당·지역·보유처순'],['REGION','지역순'],['COLOR','색상순']]){const o=el('option',label);o.value=v;sort.append(o)}sort.onchange=()=>{f.sort=sort.value;page=1;paint()};
 const reset=el('button','필터 초기화');reset.className='quiet';reset.onclick=()=>{f.search='';search.value='';for(const key of Object.keys(buttons))f[key]=[];f.sort='DEFAULT';sort.value='DEFAULT';page=1;refreshFilters();paint()};actions.append(sort,reset);
 const status=el('p');status.className='stockstatus';status.setAttribute('role','status');const list=el('div');list.className='stocklist';const pager=el('div');pager.className='stockpager';root.append(tools,filters,actions,status,list,pager);
 function paint(){
  if(dead)return;list.replaceChildren();pager.replaceChildren();if(error){status.textContent=error;return}if(loading){status.textContent='재고 자료를 불러오는 중…';return}
  const found=filterInventory(rows,f),searchingLocation=clean(f.search).length>=2&&found.some(r=>clean(r.location).includes(clean(f.search)));found.sort((a,b)=>{if(f.sort==='COLOR')return a.color.localeCompare(b.color,'ko');if(f.sort==='REGION')return a.region.localeCompare(b.region,'ko')||a.color.localeCompare(b.color,'ko');if(searchingLocation)return a.modelName.localeCompare(b.modelName,'ko')||a.color.localeCompare(b.color,'ko');return staffSort(a.manager,b.manager)||a.region.localeCompare(b.region,'ko')||a.location.localeCompare(b.location,'ko')});
  const filtered=clean(f.search).length>0||['manager','region','capacity','color'].some(k=>f[k].length>0),pageSize=filtered?50:30;const pages=Math.max(1,Math.ceil(found.length/pageSize));page=Math.min(page,pages);status.textContent='조회 '+found.length.toLocaleString()+'건'+(updatedAt?' · 반영 '+new Date(updatedAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'');
  if(!found.length){list.append(el('p',clean(f.search).length===1?'검색어를 2자 이상 입력해주세요.':'조회된 재고가 없습니다.'));return}
  for(const item of found.slice(filtered?(page-1)*pageSize:0,filtered?page*pageSize:30)){const age=ageBand(item.moveDate),card=el('article');card.className='stockcard'+(age?' stockage'+age:'');const top=el('div');top.className='stockcardtop';const model=el('strong',item.modelName),color=el('span',item.color||'기본색상');color.className='stockcolor';top.append(model,color);card.append(top);const sn=el('p','S/N '+(item.serialNo||'-'));sn.className='stocksn';card.append(sn);const location=el('p');location.append(document.createTextNode('보유처 '),el('strong',item.location||'-'));card.append(location);const info=el('div');info.className='stockinfo';info.append(el('span','입고일 '+(item.moveDate||'-')),el('span','담당 '+(item.manager||'-')+(item.region?' · '+item.region:'')));card.append(info);if(age){const badge=el('span',age===180?'6개월 이상':'3개월 이상');badge.className='stockagebadge';card.append(badge)}if(item.note){const note=el('p','비고 '+item.note);note.className='stocknote';card.append(note)}list.append(card)}
  if(!filtered){if(found.length>30){const hint=el('p','처음 30건만 표시합니다. 검색·필터로 전체 자료를 조회하세요.');hint.className='initialhint';pager.append(hint)}return}
  for(const [label,step] of [['← 이전',-1],['다음 →',1]]){const b=el('button',label);b.className='quiet';b.disabled=step<0?page===1:page===pages;b.onclick=()=>{page+=step;paint();list.scrollIntoView({block:'start'})};pager.append(b);if(step<0)pager.append(el('span',page+' / '+pages))}
 }
 paint();if(!db||!dbApi){error='데이터 연결 준비 중입니다. 잠시 후 재고 메뉴를 다시 열어주세요.';paint();return ()=>{dead=true;dialog?.remove()}}
 const stop=dbApi.onValue(dbApi.ref(db,'inventory'),snap=>{if(dead)return;const data=snap.val();rows=Object.values(data?.rows||{}).map(r=>({...r,capacity:capacity(r.modelName)}));updatedAt=data?.updatedAt||0;loading=false;error='';refreshFilters();paint()},()=>{if(dead)return;rows=[];loading=false;error='재고를 읽지 못했습니다. 재고 권한과 Firebase 재고 규칙을 확인해주세요.';paint()});
 return ()=>{dead=true;rows=[];stop();dialog?.remove();list.replaceChildren()};
}
