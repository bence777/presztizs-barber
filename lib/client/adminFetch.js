export async function adminFetch(url,options){
 const response=await fetch(url,options);
 if(response.status!==403)return response;
 const data=await response.clone().json().catch(()=>({}));
 if(!['mfa_required','reauth_required'].includes(data.code))return response;
 const confirmed=await new Promise(resolve=>window.dispatchEvent(new CustomEvent('demeters:reauth',{detail:{resolve}})));
 // The server rejected this request before any mutation; replay after explicit MFA.
 return confirmed?fetch(url,options):response;
}
