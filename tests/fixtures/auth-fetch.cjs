// Local provider simulation. Load ONLY with NODE_OPTIONS in the dedicated test.
require('./public-seo-fetch.cjs');
const prior=globalThis.fetch;
const owner='11111111-1111-4111-8111-111111111111',barber='22222222-2222-4222-8222-222222222222',sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',factorId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const factors=[{id:factorId,factor_type:'totp',status:'verified',friendly_name:'Fixture Authenticator'}];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const jwt=(id,aal='aal1')=>'fixture.'+Buffer.from(JSON.stringify({sub:id,session_id:sid,aal,amr:aal==='aal2'?[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]:[]})).toString('base64url')+'.signature';
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url||input.href),body=options.body?JSON.parse(options.body):{};
 if(url.hostname==='challenges.cloudflare.com')return json({success:body.response?.startsWith('valid-'),hostname:'127.0.0.1',action:body.response?.includes('password')?'password':'send-code'});
 if(url.hostname!=='auth-fixture.supabase.co')throw new Error('Provider test forbids real network access');
 if(url.pathname==='/auth/v1/user'){
  let claims={};try{claims=JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1],'base64url'))}catch{}
  const id=claims.sub;if(![owner,barber].includes(id))return json({},401);
  return json({id,email:id===owner?'owner@test.invalid':'barber@test.invalid',factors:id===owner?factors:[]});
 }
 if(url.pathname==='/auth/v1/factors/'+factorId+'/challenge')return json({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'});
 if(url.pathname==='/auth/v1/factors/'+factorId+'/verify')return body.code==='123456'?json({access_token:jwt(owner,'aal2'),refresh_token:'fixture-refresh'}):json({},400);
 if(url.pathname==='/auth/v1/verify')return json({},401);
 if(url.pathname==='/auth/v1/token')return json({},401);
 if(url.pathname==='/auth/v1/logout')return json({});
 if(url.pathname.endsWith('/trusted_devices'))return json([{id:sid,user_id:url.searchParams.get('user_id')?.slice(3)||owner,scope:'admin',created_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),auth_session_id:sid}]);
 if(url.pathname.endsWith('/booking_managers')){
  const email=url.searchParams.get('email')?.slice(3);return json(email==='owner@test.invalid'?[{email,role:'owner',staff_id:null}]:email==='barber@test.invalid'?[{email,role:'barber',staff_id:'paliga-zoltan'}]:[]);
 }
 if(url.pathname.endsWith('/booking_security_settings'))return json({admin_absolute_seconds:86400,admin_idle_seconds:1800,require_staff_mfa:false});
 if(url.pathname.endsWith('/booking_touch_trusted_device'))return json([{id:sid,user_id:body.p_user,scope:body.p_scope,last_seen_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()}]);
 if(url.pathname.endsWith('/booking_queue_admin_otp'))return json(null);
 if(url.pathname.endsWith('/booking_login_backoff'))return json(body.p_failure?100:0);
 return prior(input,options);
};
