import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {coarseDeviceLabel,registerTrustedDevice,verifyTrustedDevice,listTrustedDevices,removeTrustedDevice,setDeviceCookie,clearDeviceCookie} from '../lib/server/trustedDevices.js';
import {getGuest,setGuestCookies} from '../lib/server/guestAuth.js';
import {getAdmin,setAdminCookies} from '../lib/server/adminAuth.js';

process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_testing';
process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';
process.env.SESSION_SIGNING_SECRET='a-purely-test-secret-string-more-than-32-chars';
process.env.NODE_ENV='development';
const USER='12345678-1234-4234-8234-123456789abc';
const SESSION='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN='test.'+Buffer.from(JSON.stringify({session_id:SESSION,aal:'aal2'})).toString('base64url')+'.signature';
const OTHER='98765432-4321-4432-8432-123456789abc';
function response(){const headers=new Map();return {getHeader:k=>headers.get(k),setHeader:(k,v)=>headers.set(k,v)};}
function jar(res){return Object.fromEntries((res.getHeader('Set-Cookie')||[]).map(v=>{const n=v.split(';')[0].split('=');return [n[0],decodeURIComponent(n.slice(1).join('='))]}));}
function ok(data,status=200){return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)};}
const savedFetch=globalThis.fetch;
let devices=[];
let operations=[];
const hash=token=>createHash('sha256').update(token).digest('hex');
const newId=()=>`12345678-1234-4234-8234-${String(devices.length+1).padStart(12,'0')}`;
function mockDb(){globalThis.fetch=async(url,opts={})=>{
  const path=String(url);operations.push({path,method:opts.method||'GET',headers:opts.headers,body:opts.body&&JSON.parse(opts.body)});
  if(path.includes('/rpc/booking_session_active'))return ok(true);
  if(path.includes('/rpc/booking_security_settings'))return ok({admin_absolute_seconds:86400,admin_idle_seconds:1800,require_staff_mfa:false});
  if(path.includes('/rest/v1/booking_managers'))return ok([{email:'user@example.com',role:'owner',staff_id:null}]);
  if(path.endsWith('/auth/v1/user'))return ok({id:USER,email:'user@example.com'});
  if(path.includes('/rest/v1/rpc/booking_touch_trusted_device')){
    const body=JSON.parse(opts.body),now=Date.now();
    const row=devices.find(d=>d.user_id===body.p_user&&d.scope===body.p_scope&&d.credential_hash===body.p_hash&&Date.parse(d.expires_at)>now);
    if(!row)return ok([]);
    row.last_seen_at=new Date(now).toISOString();
    if(body.p_scope==='admin')row.expires_at=new Date(Math.min(Date.parse(row.expires_at),Date.parse(row.created_at)+86400000)).toISOString();
    else if(body.p_extend)row.expires_at=new Date(Math.max(Date.parse(row.expires_at),now+60*86400000)).toISOString();
    return ok([row]);
  }
  if(!path.includes('/rest/v1/trusted_devices'))throw new Error('unmocked '+path);
  assert.equal(opts.headers.apikey,process.env.SUPABASE_SECRET_KEY);
  const query=new URL(path).searchParams;
  const rows=devices.filter(d=>[...query].every(([k,v])=>{
    if(k==='select'||k==='order'||k==='limit')return true;
    if(v.startsWith('eq.'))return String(d[k])===v.slice(3);
    if(v.startsWith('gt.'))return new Date(d[k]).getTime()>new Date(v.slice(3)).getTime();
    return true;
  }));
  if(opts.method==='POST'){
    const entry={...JSON.parse(opts.body),id:newId(),created_at:new Date(Date.now()).toISOString(),last_seen_at:new Date(Date.now()).toISOString()};devices.push(entry);return ok([entry],201);
  }
  if(opts.method==='PATCH'){
    Object.assign(rows[0]||{},JSON.parse(opts.body));return ok([...(rows[0]?[rows[0]]:[])]);
  }
  if(opts.method==='DELETE'){
    devices=devices.filter(d=>!rows.includes(d));return ok(rows);
  }
  return ok(rows);
};}

test.beforeEach(()=>{devices=[];operations=[];mockDb()});
test.after(()=>{globalThis.fetch=savedFetch});

test('No fingerprinting: labels are deliberately coarse and omit versions',()=>{
  const x=coarseDeviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/27 Safari/605.1.15');
  assert.equal(x,'Safari · macOS');assert.doesNotMatch(x,/27|605|10_15_7/);
});

test('Guest + admin devices coexist, never overwrite each other',async()=>{
  const expiry=Date.now()+86400000;
  const guest=await registerTrustedDevice({headers:{'user-agent':'Firefox/123 (Windows NT 10.0)'}},{userId:USER,scope:'guest',expiresAt:expiry,sessionId:SESSION});
  const admin=await registerTrustedDevice({headers:{'user-agent':'Chrome/123 (Windows NT 10.0)'}},{userId:USER,scope:'admin',expiresAt:expiry,sessionId:SESSION});
  assert.notEqual(guest,admin);assert.equal(devices.length,2);
  const rg=response();setDeviceCookie(rg,'guest',guest,expiry,true);
  const ra=response();setDeviceCookie(ra,'admin',admin,expiry,true);
  assert.ok(jar(rg).pb_trusted_device);assert.ok(jar(ra).pb_admin_trusted_device);
  assert.equal(jar(ra).pb_trusted_device,undefined);
  assert.equal((await listTrustedDevices({cookies:jar(rg)},{userId:USER,scope:'guest'})).length,1);
  assert.equal((await listTrustedDevices({cookies:jar(ra)},{userId:USER,scope:'admin'})).length,1);
  assert.equal(await verifyTrustedDevice({cookies:jar(rg)},{userId:USER,scope:'admin'}),null);
});

test('Revoked credential is denied on next request, other device keeps access',async()=>{
  const expiry=Date.now()+86400000;
  const one=await registerTrustedDevice({headers:{}},{userId:USER,scope:'guest',expiresAt:expiry,sessionId:SESSION});
  const two=await registerTrustedDevice({headers:{}},{userId:USER,scope:'guest',expiresAt:expiry,sessionId:SESSION});
  const first={cookies:{pb_trusted_device:one}};
  const second={cookies:{pb_trusted_device:two}};
  const current=await listTrustedDevices(first,{userId:USER,scope:'guest'});
  assert.equal(current.filter(d=>d.current).length,1);
  assert.ok(await verifyTrustedDevice(first,{userId:USER,scope:'guest'}));
  assert.equal(await removeTrustedDevice({userId:OTHER,scope:'guest',id:current.find(d=>d.current).id}),false);
  assert.equal(await removeTrustedDevice({userId:USER,scope:'guest',id:current.find(d=>d.current).id}),true);
  assert.equal(await verifyTrustedDevice(first,{userId:USER,scope:'guest'}),null);
  assert.ok(await verifyTrustedDevice(second,{userId:USER,scope:'guest'}));
});

test('Guest HTTP authorization is revoked immediately when the device record is deleted',async()=>{
  const expiry=Date.now()+86400000;
  const credential=await registerTrustedDevice({headers:{}},{userId:USER,scope:'guest',expiresAt:expiry,sessionId:SESSION});
  const r=response();setGuestCookies(r,{access_token:TOKEN,refresh_token:'refresh'},USER,{remember:true});setDeviceCookie(r,'guest',credential,expiry,true);
  const req={cookies:jar(r)};
  assert.equal((await getGuest(req,response()))?.user?.id,USER);
  const current=(await listTrustedDevices(req,{userId:USER,scope:'guest'}))[0];
  await removeTrustedDevice({userId:USER,scope:'guest',id:current.id});
  const denied=response();assert.equal(await getGuest(req,denied),null);
  assert.ok(jar(denied).pb_trusted_device==='');
});

test('Admin and guest cookies expire independently and are HttpOnly',async()=>{
  const expiry=Date.now()+86400000;
  const reg=await registerTrustedDevice({headers:{}},{userId:USER,scope:'admin',expiresAt:expiry,sessionId:SESSION});
  const res=response();setAdminCookies(res,{access_token:TOKEN,refresh_token:'rr'},USER,undefined,false);setDeviceCookie(res,'admin',reg,expiry,false);
  const cookies=res.getHeader('Set-Cookie');
  assert.ok(cookies.every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Lax')));
  assert.ok(cookies.every(c=>!c.includes('Max-Age=') ));
  assert.ok((await getAdmin({cookies:jar(res)},response()))?.user?.id===USER);
  const removed=response();clearDeviceCookie(removed,'admin');assert.equal(jar(removed).pb_admin_trusted_device,'');
});


for(const [scope,days,getAuth,setAuth] of [
 ['guest',60,getGuest,(res,tokens,id)=>setGuestCookies(res,tokens,id,{remember:true})],
]){
 test(`${scope}: every verified use renews signed cookies and the DB deadline by ${days} days`,async()=>{
  const realNow=Date.now,started=realNow();let now=started;Date.now=()=>now;
  try{
   const credential=await registerTrustedDevice({headers:{}},{userId:USER,scope,expiresAt:started+days*86400000,sessionId:SESSION});
   const initial=response();setAuth(initial,{access_token:TOKEN,refresh_token:'refresh'},USER);setDeviceCookie(initial,scope,credential,started+days*86400000,true);
   const req={cookies:jar(initial)};now+=86400000;
   const used=response();assert.equal((await getAuth(req,used)).user.id,USER);
   const renewed=jar(used),key=scope==='admin'?'pb_admin_until':'pb_device_until';
   assert.equal(Number(renewed[key].split('.')[1]),now+days*86400000);
   assert.equal(Date.parse(devices[0].expires_at),now+days*86400000);
   assert.equal(used.getHeader('Set-Cookie').length,4);
   assert.ok(used.getHeader('Set-Cookie').every(c=>c.includes(`Max-Age=${days*86400}`)&&c.includes('HttpOnly')&&c.includes('SameSite=Lax')));
   req.cookies={...req.cookies,...renewed};now=started+days*86400000+3600000;
   const again=response();assert.equal((await getAuth(req,again)).user.id,USER);
   assert.equal(Date.parse(devices[0].expires_at),now+days*86400000);
   const touches=operations.filter(op=>op.path.includes('/rpc/booking_touch_trusted_device'));
   assert.equal(touches.length,2);assert.equal(touches[0].body.p_extend,true);assert.equal(touches[0].body.p_hash,hash(credential));
  }finally{Date.now=realNow;}
 });
}

test('a temporary login remains limited to its original deadline and never becomes remembered',async()=>{
 const realNow=Date.now,start=realNow();let now=start;Date.now=()=>now;
 try{
  const credential=await registerTrustedDevice({headers:{}},{userId:USER,scope:'admin',expiresAt:start+12*3600000,sessionId:SESSION});
  const initial=response();setAdminCookies(initial,{access_token:TOKEN,refresh_token:'refresh'},USER,undefined,false);setDeviceCookie(initial,'admin',credential,start+12*3600000,false);
  now+=10*60000;const req={cookies:jar(initial)},used=response();assert.equal((await getAdmin(req,used)).user.id,USER);
  assert.equal(Date.parse(devices[0].expires_at),start+12*3600000);assert.equal(used.getHeader('Set-Cookie'),undefined);
  assert.equal(operations.find(op=>op.path.includes('/rpc/booking_touch_trusted_device')).body.p_extend,false);
  now=start+12*3600000+1;assert.equal(await getAdmin(req,response()),null);
 }finally{Date.now=realNow}
});

test('a device revoked between the initial read and the authenticated touch is not recreated',async()=>{
 const expiry=Date.now()+7*86400000;
 const credential=await registerTrustedDevice({headers:{}},{userId:USER,scope:'admin',expiresAt:expiry,sessionId:SESSION});
 const initial=response();setAdminCookies(initial,{access_token:TOKEN,refresh_token:'refresh'},USER);setDeviceCookie(initial,'admin',credential,expiry,true);
 const dbFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{if(String(url).includes('/rpc/booking_touch_trusted_device'))devices=[];return dbFetch(url,options)};
 const denied=response();assert.equal(await getAdmin({cookies:jar(initial)},denied),null);assert.equal(devices.length,0);assert.equal(jar(denied).pb_admin_until,'');
});

test('an unrelated Supabase identity cannot prolong a signed admin session',async()=>{
 const expiry=Date.now()+7*86400000;
 const credential=await registerTrustedDevice({headers:{}},{userId:USER,scope:'admin',expiresAt:expiry,sessionId:SESSION});
 const initial=response();setAdminCookies(initial,{access_token:TOKEN,refresh_token:'refresh'},USER);setDeviceCookie(initial,'admin',credential,expiry,true);
 const dbFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>String(url).endsWith('/auth/v1/user')?ok({id:OTHER,email:'other@example.com'}):dbFetch(url,options);
 assert.equal(await getAdmin({cookies:jar(initial)},response()),null);
 assert.equal(Date.parse(devices[0].expires_at),expiry);assert.equal(operations.filter(op=>op.path.includes('/rpc/booking_touch_trusted_device')).length,0);
});

test('admin: activity cannot extend the absolute lifetime; idle time requires a new login',async()=>{
 const start=Date.now(),credential=await registerTrustedDevice({headers:{}},{userId:USER,scope:'admin',expiresAt:start+7*86400000,sessionId:SESSION});
 const initial=response();setAdminCookies(initial,{access_token:TOKEN,refresh_token:'r'},USER);setDeviceCookie(initial,'admin',credential,start+7*86400000,true);
 const req={cookies:jar(initial)},used=response();assert.equal((await getAdmin(req,used)).user.id,USER);
 assert.equal(Date.parse(devices[0].expires_at),Date.parse(devices[0].created_at)+86400000);
 devices[0].last_seen_at=new Date(Date.now()-31*60000).toISOString();
 assert.equal(await getAdmin(req,response()),null);
});
