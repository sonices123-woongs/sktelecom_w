const SKW_PROJECT='sktelecom-w';
const SKW_OWNER='sonices123@gmail.com';
function requireOwner_(){
  if(Session.getEffectiveUser().getEmail().toLowerCase()!==SKW_OWNER)throw new Error('소유자 계정만 사용할 수 있습니다.');
}
function doGet(e){
  requireOwner_();
  if(e&&e.parameter&&e.parameter.bridge==='1'){const t=HtmlService.createTemplateFromFile('Bridge');t.nonce=String(e.parameter.nonce||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,80);return t.evaluate().setTitle('SKW 초기화 연결').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)}
  return HtmlService.createHtmlOutputFromFile('Reset').setTitle('SKW 비밀번호 초기화');
}
function resetMemberPassword_(username,password){
  requireOwner_();
  username=String(username||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{1,49}$/.test(username))throw new Error('아이디 형식을 확인해주세요.');
  if(typeof password!=='string'||password.length<6||password.length>128)throw new Error('임시 비밀번호는 6~128자로 입력해주세요.');
  const email=username+'@accounts.skw.invalid';
  const token=ScriptApp.getOAuthToken();
  const call=(method,payload)=>{
    const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/projects/'+SKW_PROJECT+'/accounts:'+method,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify(payload),muteHttpExceptions:true});
    if(response.getResponseCode()!==200){
      let info={};try{info=JSON.parse(response.getContentText()).error||{}}catch(ignore){}
      const details=info.details||[];
      const parts=[info.status||'UNKNOWN'];
      for(const d of details){if(d.reason)parts.push(d.reason);const m=d.metadata||{};for(const key of ['service','consumer','permission'])if(m[key])parts.push(key+': '+m[key])}
      throw new Error('Firebase '+method+' 실패 ('+response.getResponseCode()+') / '+parts.join(' / '));
    }
    return JSON.parse(response.getContentText());
  };
  const users=call('lookup',{email:[email]}).users||[];
  if(users.length!==1||users[0].email.toLowerCase()!==email)throw new Error('해당 아이디를 찾지 못했습니다.');
  const user=users[0];
  if(!(user.providerUserInfo||[]).some(p=>p.providerId==='password'))throw new Error('일반 아이디 계정만 초기화할 수 있습니다.');
  const result=call('update',{localId:user.localId,password:password,validSince:String(Math.floor(Date.now()/1000))});
  if(result.localId!==user.localId)throw new Error('완료 여부를 확인하지 못했습니다. 다시 로그인하여 확인해주세요.');
  return username+' 초기화 완료. 임시 비밀번호를 전달하고 로그인 후 비밀번호 변경을 안내해주세요.';
}

function checkResetConnection(){
  requireOwner_();
  const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/projects/'+SKW_PROJECT+'/accounts:lookup',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({email:['skw-connection-check@accounts.skw.invalid']}),muteHttpExceptions:true});
  if(response.getResponseCode()===200){console.log('Firebase 연결 정상. 비밀번호는 변경하지 않았습니다.');return}
  let info={};try{info=JSON.parse(response.getContentText()).error||{}}catch(ignore){}
  const parts=['HTTP '+response.getResponseCode(),info.status||'UNKNOWN'];
  for(const d of info.details||[]){if(d.reason)parts.push(d.reason);const m=d.metadata||{};for(const key of ['service','consumer','permission'])if(m[key])parts.push(key+': '+m[key])}
  console.log(parts.join(' / '));
}

function resetFromApp(idToken,username){
 requireOwner_();
 if(typeof idToken!=='string'||idToken.length>10000)throw new Error('관리자 인증이 필요합니다.');
 const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyCFz-2jzyAPKBRxTtao3qFxPfDQ5iD5vUI',{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:idToken}),muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('관리자 로그인을 다시 확인해주세요.');
 const users=JSON.parse(response.getContentText()).users||[];
 const u=users[0];
 if(users.length!==1||String(u.email).toLowerCase()!==SKW_OWNER||!u.emailVerified||!(u.providerUserInfo||[]).some(p=>p.providerId==='google.com'))throw new Error('소유자 관리자만 초기화할 수 있습니다.');
 // No password or ID token is persisted or logged.
 const password='Sk!'+Utilities.getUuid().replace(/-/g,'').slice(0,15);
 resetMemberPassword_(username,password);
 return {ok:true,password:password};
}
