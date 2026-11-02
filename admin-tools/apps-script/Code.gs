const SKW_PROJECT='sktelecom-w';
const SKW_OWNER='sonices123@gmail.com';
function requireOwner_(){
  if(Session.getEffectiveUser().getEmail().toLowerCase()!==SKW_OWNER)throw new Error('소유자 계정만 사용할 수 있습니다.');
}
function doGet(e){
  requireOwner_();
  return HtmlService.createHtmlOutputFromFile('Reset').setTitle('SKW 비밀번호 초기화');
}
function resetMemberPassword(username,password){
  requireOwner_();
  username=String(username||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{1,49}$/.test(username))throw new Error('아이디 형식을 확인해주세요.');
  if(typeof password!=='string'||password.length<6||password.length>128)throw new Error('임시 비밀번호는 6~128자로 입력해주세요.');
  const email=username+'@accounts.skw.invalid';
  const token=ScriptApp.getOAuthToken();
  const call=(method,payload)=>{
    const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/projects/'+SKW_PROJECT+'/accounts:'+method,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify(payload),muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw new Error('Firebase 처리 실패 ('+response.getResponseCode()+'). 계정 권한과 비밀번호 정책을 확인해주세요.');
    return JSON.parse(response.getContentText());
  };
  const users=call('lookup',{email:[email]}).users||[];
  if(users.length!==1||users[0].email.toLowerCase()!==email)throw new Error('해당 아이디를 찾지 못했습니다.');
  const user=users[0];
  if(!(user.providerUserInfo||[]).some(p=>p.providerId==='password'))throw new Error('일반 아이디 계정만 초기화할 수 있습니다.');
  const result=call('update',{localId:user.localId,password:password});
  if(result.localId!==user.localId)throw new Error('완료 여부를 확인하지 못했습니다. 다시 로그인하여 확인해주세요.');
  return username+' 초기화 완료. 임시 비밀번호를 전달하고 로그인 후 비밀번호 변경을 안내해주세요.';
}
