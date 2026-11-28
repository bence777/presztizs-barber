let scriptReady;
export async function botToken(action) {
 const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
 if(!key)return undefined;
 if(!scriptReady)scriptReady=new Promise((resolve,reject)=>{
  if(window.turnstile)return resolve();
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  script.onload=resolve;script.onerror=()=>{scriptReady=null;reject(new Error('A biztonsági ellenőrzés nem töltődött be. / Security check did not load.'));};document.head.append(script);
 });
 await scriptReady;
 return new Promise((resolve,reject)=>{
  const container=document.createElement('div');container.setAttribute('aria-label','Biztonsági ellenőrzés / Security check');document.body.append(container);
  let widget,timer;
  const finish=(error,token)=>{clearTimeout(timer);if(widget!==undefined)window.turnstile.remove(widget);container.remove();error?reject(error):resolve(token);};
  timer=setTimeout(()=>finish(new Error('Az ellenőrzés lejárt. / Verification timed out.')),120000);
  widget=window.turnstile.render(container,{sitekey:key,action,execution:'execute',appearance:'interaction-only',callback:token=>finish(null,token),'error-callback':()=>finish(new Error('Ismételd meg az ellenőrzést. / Repeat verification.')),'expired-callback':()=>finish(new Error('Az ellenőrzés lejárt. / Verification expired.'))});
  window.turnstile.execute(widget);
 });
}
