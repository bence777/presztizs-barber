import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

process.env.SUPABASE_URL='https://test-presztizs.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test_only';
process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';
process.env.SESSION_SIGNING_SECRET='only-for-test-64-char-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.NODE_ENV='development';

const {getAdmin,setAdminCookies,clearAdminCookies}=await import('../lib/server/adminAuth.js');
const {getGuest}=await import('../lib/server/guestAuth.js');
const {setDeviceCookie}=await import('../lib/server/trustedDevices.js');
const {managerFor,requireManager}=await import('../lib/server/bookingManagement.js');
const USER_ID='12345678-1234-4234-8234-123456789abc';
const EMAIL='owner@example.com';

function response() {
  const headers=new Map();
  const res={statusCode:200,body:null,headers,
    setHeader(key,value){headers.set(key,value)},getHeader(key){return headers.get(key)},
    status(value){this.statusCode=value;return this},json(value){this.body=value;return this}
  };
  return res;
}
function sessionCookies() {
  const res=response();
  setAdminCookies(res,{access_token:'admin-token',refresh_token:'admin-refresh'},USER_ID);
  setDeviceCookie(res,'admin','A'.repeat(43),Date.now()+7*24*60*60*1000,true);
  const req={cookies:{}};
  for(const raw of res.getHeader('Set-Cookie')){
    const [name,value]=raw.split(';',1)[0].split('=');
    req.cookies[name]=decodeURIComponent(value);
  }
  return {req,res};
}
const originalFetch=globalThis.fetch;
let requests=[];
globalThis.fetch=async(url,options={})=>{
  requests.push({url:String(url),options});
  if(String(url).includes('/rest/v1/trusted_devices')) return {ok:true,status:200,text:async()=>JSON.stringify([{id:USER_ID,user_id:USER_ID,scope:'admin',last_seen_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()}])};
  if(String(url).endsWith('/auth/v1/user')) return {ok:true,status:200,text:async()=>JSON.stringify({id:USER_ID,email:EMAIL})};
  if(String(url).includes('/rest/v1/booking_managers')) return {ok:true,status:200,text:async()=>JSON.stringify([{email:EMAIL,role:'owner',staff_id:null}])};
  throw new Error('unexpected request '+url);
};

test('Guest cookies alone NEVER authenticate the salon administrator',async()=>{
  requests=[];
  const res=response();
  const ctx=await managerFor({cookies:{pb_access:'guest',pb_refresh:'guest-refresh',pb_device_until:'guest-signature'}},res);
  assert.deepEqual(ctx,{admin:null,manager:null});
  assert.equal(requests.length,0);
  const denied=await requireManager({cookies:{pb_access:'guest'}},res);
  assert.equal(denied,null);
  assert.equal(res.statusCode,401);
});

test('Admin session is independent from guest cookie auth',async()=>{
  const {req,res}=sessionCookies();
  assert.ok(req.cookies.pb_admin_access);
  assert.ok(req.cookies.pb_admin_refresh);
  assert.ok(req.cookies.pb_admin_until);
  assert.ok(req.cookies.pb_admin_trusted_device);
  assert.equal(req.cookies.pb_access,undefined);
  const noGuest=await getGuest(req,res);
  assert.equal(noGuest,null);
  const admin=await getAdmin(req,res);
  assert.equal(admin.user.email,EMAIL);
  assert.equal(admin.token,'admin-token');
  const session=await managerFor(req,res);
  assert.equal(session.manager.role,'owner');
  assert.equal(session.manager.email,EMAIL);
});

test('Tampered admin deadline invalidates the admin session',async()=>{
  const {req}=sessionCookies();
  req.cookies.pb_admin_until+='a';
  assert.equal(await getAdmin(req,response()),null);
});

test('Admin logout clears ONLY admin cookies, leaving guest login intact',()=>{
  const res=response();
  clearAdminCookies(res);
  const cookies=res.getHeader('Set-Cookie');
  assert.equal(cookies.length,4);
  assert.ok(cookies.every(x=>x.startsWith('pb_admin_')));
  assert.ok(cookies.every(x=>x.includes('Max-Age=0')));
  assert.ok(cookies.every(x=>x.includes('HttpOnly')));
  assert.ok(cookies.every(x=>x.includes('SameSite=Lax')));
  assert.ok(!cookies.some(x=>x.startsWith('pb_access=')));
});

test('Admin login and guest identity remain separate at page and API boundaries',()=>{
  const page=readFileSync(new URL('../pages/admin/foglalasok.jsx',import.meta.url),'utf8');
  const guest=readFileSync(new URL('../pages/foglalasaim.jsx',import.meta.url),'utf8');
  const gate=readFileSync(new URL('../components/BookingManagePage.jsx',import.meta.url),'utf8');
  const manager=readFileSync(new URL('../lib/server/bookingManagement.js',import.meta.url),'utf8');
  assert.match(page,/AdminIdentityGate/);
  assert.doesNotMatch(page,/BookingIdentityGate/);
  assert.match(guest,/BookingManagePage/);
  assert.match(gate,/BookingIdentityGate/);
  assert.doesNotMatch(manager,/getGuest\(/);
  const send=readFileSync(new URL('../pages/api/admin/auth/send-code.js',import.meta.url),'utf8');
  const verify=readFileSync(new URL('../pages/api/admin/auth/verify-code.js',import.meta.url),'utf8');
  assert.match(send,/managerByEmail/);
  assert.match(verify,/managerByEmail/);
  assert.match(verify,/setAdminCookies/);
});

test.after(()=>{globalThis.fetch=originalFetch});
