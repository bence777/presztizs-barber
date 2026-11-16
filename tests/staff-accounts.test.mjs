import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCalendarLayout,CALENDAR_CARD_HEIGHT} from '../lib/client/calendarLayout.mjs';
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
const {staffLoginEmail,saveStaffAccount,readStaffAccounts,setEmailStaffAccess,staffPasswordLogin}=await import('../lib/server/staffAccounts.js');
const owner={role:'owner'},barber={role:'barber',staff_id:'barber-1'};
const email='demeter.tamas@staff.demeters.invalid',uid='11111111-1111-4111-8111-111111111111';
const input={loginName:'demeter.tamas',staffId:'barber-1',name:'Demeter Tamás',password:'Long-test-password-2026',active:true};
let accounts=[],users=[],calls=[],authFails=false,wrongToken=false;
const original=globalThis.fetch;
globalThis.fetch=async(raw,options={})=>{
 const url=new URL(raw),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({url,method,body,headers:options.headers});
 const table=url.pathname.split('/').pop();let data=[],ok=true,status=200;
 if(url.pathname==='/auth/v1/token')data=wrongToken?{user:{id:uid,email:'someone-else@test.invalid'},access_token:'x',refresh_token:'r'}:{user:{id:uid,email},access_token:'staff-token',refresh_token:'staff-refresh'};
 else if(url.pathname.includes('/auth/v1/admin/')){
  if(authFails){ok=false;status=503;data={};}
  else if(method==='GET')data={users};
  else if(method==='POST'){data={id:uid,...body};users.push(data);}
  else data=users[0];
 }else if(table==='booking_staff')data=[{id:'barber-1',name:'Demeter Tamás',active:true}];
 else if(table==='booking_managers'){
  const match=row=>(!url.searchParams.get('email')||url.searchParams.get('email')===`eq.${row.email}`)&&(!url.searchParams.get('role')||url.searchParams.get('role')===`eq.${row.role}`)&&(!url.searchParams.get('active')||url.searchParams.get('active')===`eq.${row.active}`);
  if(method==='POST'){accounts.push({...body});data=[];}
  else if(method==='PATCH'){data=accounts.filter(match).map(row=>{Object.assign(row,body);return row});}
  else data=accounts.filter(match);
 }
 return {ok,status,json:async()=>data,text:async()=>JSON.stringify(data)};
};
test.beforeEach(()=>{accounts=[];users=[];calls=[];authFails=false;wrongToken=false});test.after(()=>{globalThis.fetch=original});
test('staff cannot list, provision or change any staff login',async()=>{
 for(const f of [()=>readStaffAccounts(barber),()=>saveStaffAccount(input,barber),()=>setEmailStaffAccess({email,active:false},barber)])await assert.rejects(f,e=>e.status===403);
 assert.equal(calls.length,0);
});
test('username validation blocks addresses, injected filters and shared owner identities',()=>{
 assert.equal(staffLoginEmail('Demeter.Tamas'),email);
 for(const value of ['owner@test.invalid','../owner','ab','admin,role.eq.owner'])assert.throws(()=>staffLoginEmail(value));
});
test('owner creates an individually scoped staff login without sending email',async()=>{
 const result=await saveStaffAccount({...input,role:'owner'},owner);
 assert.deepEqual(result,{loginName:'demeter.tamas',email:null,staffId:'barber-1',active:true});
 assert.equal(accounts[0].role,'barber');assert.equal(accounts[0].staff_id,'barber-1');
 assert.equal(calls.find(c=>c.url.pathname==='/auth/v1/admin/users'&&c.method==='POST').body.email_confirm,true);
 assert.ok(!JSON.stringify(result).includes(input.password));assert.ok(!calls.some(c=>c.url.pathname.endsWith('/otp')));
 assert.equal(calls.find(c=>c.url.pathname==='/auth/v1/admin/users').headers.apikey,'sb_secret_test');
});
test('failed auth provisioning leaves account disabled and can be retried',async()=>{
 authFails=true;await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===503);assert.equal(accounts[0].active,false);
 authFails=false;await saveStaffAccount(input,owner);assert.equal(accounts[0].active,true);
});
test('existing owner permissions and another staff assignment cannot be overwritten',async()=>{
 accounts=[{email,role:'owner',staff_id:null,active:true}];await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===409);
 accounts=[{email,role:'barber',staff_id:'barber-2',active:true}];await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===409);
 assert.ok(!calls.some(c=>c.method==='POST'||c.method==='PUT'||c.method==='PATCH'));
});
test('password changes revoke admin devices for exactly that staff identity',async()=>{
 accounts=[{email,role:'barber',staff_id:'barber-1',active:true}];users=[{id:uid,email}];await saveStaffAccount(input,owner);
 const revoke=calls.find(c=>c.url.pathname.endsWith('/trusted_devices'));assert.equal(revoke.method,'DELETE');assert.equal(revoke.url.searchParams.get('scope'),'eq.admin');assert.equal(revoke.url.searchParams.get('user_id'),`eq.${uid}`);
});
test('disabled staff cannot sign in and tokens for a different user are rejected',async()=>{
 accounts=[{email,role:'barber',staff_id:'barber-1',active:false}];await assert.rejects(()=>staffPasswordLogin('demeter.tamas',input.password),e=>e.status===401);
 assert.ok(!calls.some(c=>c.url.pathname==='/auth/v1/token'));
 accounts[0].active=true;wrongToken=true;await assert.rejects(()=>staffPasswordLogin('demeter.tamas',input.password),e=>e.status===401);
 wrongToken=false;const result=await staffPasswordLogin('demeter.tamas',input.password);assert.equal(result.manager.staff_id,'barber-1');assert.equal(result.session.access_token,'staff-token');
});
test('short passwords are rejected before creating privileges or auth users',async()=>{
 await assert.rejects(()=>saveStaffAccount({...input,password:'short'},owner),e=>e.status===400);assert.ok(!calls.some(c=>c.method!=='GET'));
});
test('calendar gives 15, 30 and 60 minute bookings the same height and full-width stack positions',()=>{
 const records=[{id:'a',starts_at:'09:00',duration:15},{id:'b',starts_at:'09:00',duration:60},{id:'c',starts_at:'09:30',duration:30}];
 const minuteOf=s=>Number(s.slice(0,2))*60+Number(s.slice(3));const layout=buildCalendarLayout(['2026-11-16','2026-11-17'],new Map([['2026-11-16',records]]),8,21,minuteOf);
 assert.equal(CALENDAR_CARD_HEIGHT,76);assert.ok(layout.positions.get('b')-layout.positions.get('a')>=CALENDAR_CARD_HEIGHT+8);assert.ok(layout.positions.get('c')>=layout.positions.get('b')+CALENDAR_CARD_HEIGHT);assert.equal(layout.rows[2].top,layout.position(9*60));
});
