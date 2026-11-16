import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCalendarLayout,CALENDAR_CARD_HEIGHT} from '../lib/client/calendarLayout.mjs';
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
const {staffAccountEmail,staffLoginEmail,saveStaffAccount,readStaffAccounts,setEmailStaffAccess,staffPasswordLogin}=await import('../lib/server/staffAccounts.js');
const owner={role:'owner'},barber={role:'barber',staff_id:'barber-1'};
const email='tamas@example.com',uid='11111111-1111-4111-8111-111111111111';
const input={email,staffId:'barber-1',name:'Demeter Tamás',active:true};
const newStaffId='barber-22222222-2222-4222-8222-222222222222';
let accounts,users,staff,hours,calls,authFails,wrongToken,missingReadback;
const original=globalThis.fetch;
globalThis.fetch=async(raw,options={})=>{
 const url=new URL(raw),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({url,method,body,headers:options.headers});
 const table=url.pathname.split('/').pop();let data=[],ok=true,status=200;
 const match=row=>['email','role','staff_id','id','active'].every(key=>!url.searchParams.get(key)||url.searchParams.get(key)===`eq.${row[key]}`);
 if(url.pathname==='/auth/v1/token')data=wrongToken?{user:{id:uid,email:'someone-else@example.com'},access_token:'x',refresh_token:'r'}:{user:{id:uid,email:body.email},access_token:'staff-token',refresh_token:'staff-refresh'};
 else if(url.pathname.includes('/auth/v1/admin/')){
  if(authFails){ok=false;status=503;data={};}
  else if(method==='GET')data=table==='users'?{users}:missingReadback?null:users.find(u=>u.id===table)||null;
  else if(method==='POST'){data={id:uid,...body};users.push(data);}
  else {throw new Error('Existing Auth identities must not be changed by staff creation');}
 }else if(table==='booking_staff'){
  if(method==='POST'){staff.push({...body});data=[];}
  else if(method==='PATCH')data=staff.filter(match).map(s=>Object.assign(s,body));
  else data=staff.filter(match);
 }else if(table==='booking_hours'){
  if(method==='POST'){for(const h of body)if(!hours.some(e=>JSON.stringify(e)===JSON.stringify(h)))hours.push(h);data=[];}
  else data=hours.filter(match);
 }else if(table==='booking_managers'){
  if(method==='POST'){accounts.push({...body});data=[];}
  else if(method==='PATCH')data=accounts.filter(match).map(row=>Object.assign(row,body));
  else data=accounts.filter(match);
 }
 return {ok,status,json:async()=>data,text:async()=>JSON.stringify(data)};
};
test.beforeEach(()=>{accounts=[];users=[];calls=[];staff=[{id:'barber-1',name:'Demeter Tamás',active:true,sort_order:1}];hours=[{staff_id:'barber-1',weekday:1,opens:'09:00:00',closes:'18:00:00'}];authFails=false;wrongToken=false;missingReadback=false});test.after(()=>{globalThis.fetch=original});
test('staff cannot list, create a barber or change any staff login',async()=>{
 for(const f of [()=>readStaffAccounts(barber),()=>saveStaffAccount({...input,createStaff:true,staffId:newStaffId},barber),()=>setEmailStaffAccess({email,active:false},barber)])await assert.rejects(f,e=>e.status===403);
 assert.equal(calls.length,0);
});
test('new accounts require a personal email and never generate synthetic addresses',()=>{
 assert.equal(staffAccountEmail(' Tamas@Example.com '),email);
 for(const value of ['demeter.tamas','a@staff.demeters.invalid','bad@','owner,role.eq.owner'])assert.throws(()=>staffAccountEmail(value));
 assert.equal(staffLoginEmail('Tamas@Example.com'),email);
 assert.equal(staffLoginEmail('demeter.tamas'),'demeter.tamas@staff.demeters.invalid');
});
test('save creates and reads back the email user in Supabase Auth before activating staff permissions',async()=>{
 const result=await saveStaffAccount({...input,role:'owner'},owner);
 assert.deepEqual(result,{loginName:null,email,staffId:'barber-1',active:true,authUserId:uid});
 assert.equal(accounts[0].role,'barber');assert.equal(accounts[0].staff_id,'barber-1');
 const create=calls.find(c=>c.url.pathname==='/auth/v1/admin/users'&&c.method==='POST');assert.equal(create.body.email,email);assert.equal(create.body.email_confirm,false);assert.equal(create.body.password,undefined);assert.equal(create.headers.apikey,'sb_secret_test');
 const readback=calls.findIndex(c=>c.url.pathname===`/auth/v1/admin/users/${uid}`),activation=calls.findIndex(c=>c.url.pathname.endsWith('/booking_managers')&&c.method==='PATCH'&&c.body.active===true);assert.ok(readback>=0&&activation>readback);
 assert.ok(!calls.some(c=>c.url.pathname.endsWith('/otp')||c.url.pathname.endsWith('/invite')));
});
test('existing Auth guest is linked without duplicate creation, password reset or forced confirmation',async()=>{
 users=[{id:uid,email,email_confirmed_at:'2026-11-16T10:00Z'}];const result=await saveStaffAccount(input,owner);assert.equal(result.authUserId,uid);
 assert.equal(calls.filter(c=>c.url.pathname.includes('/auth/v1/admin/')&&c.method!=='GET').length,0);assert.equal(users.length,1);
 await assert.rejects(()=>saveStaffAccount({...input,password:'Unexpected-reset-password'},owner),e=>e.status===409);
});
test('optional initial password is saved only for a new Auth user',async()=>{
 await saveStaffAccount({...input,password:'Initial-test-password-2026'},owner);const create=calls.find(c=>c.url.pathname==='/auth/v1/admin/users'&&c.method==='POST');assert.equal(create.body.password,'Initial-test-password-2026');assert.equal(create.body.email_confirm,false);assert.ok(!calls.some(c=>c.method==='PUT'));
});
test('short optional passwords fail before any data changes',async()=>{await assert.rejects(()=>saveStaffAccount({...input,password:'short'},owner),e=>e.status===400);assert.equal(calls.length,0)});
test('new barber is added together with its Auth user and can copy an existing working schedule',async()=>{
 const result=await saveStaffAccount({...input,staffId:newStaffId,createStaff:true,copyHoursFrom:'barber-1',name:'Új Fodrász'},owner);
 assert.equal(result.staffId,newStaffId);assert.equal(staff.length,2);assert.equal(staff[1].active,true);assert.equal(staff[1].name,'Új Fodrász');assert.equal(accounts[0].staff_id,newStaffId);assert.equal(users[0].email,email);
 assert.ok(hours.some(h=>h.staff_id===newStaffId&&h.weekday===1&&h.opens==='09:00:00'));assert.equal(hours.filter(h=>h.staff_id==='barber-1').length,1);
});
test('failed Auth creation stays inactive and retry does not duplicate the barber',async()=>{
 const payload={...input,staffId:newStaffId,createStaff:true,copyHoursFrom:'barber-1'};
 authFails=true;await assert.rejects(()=>saveStaffAccount(payload,owner),e=>e.status===503);assert.equal(accounts[0].active,false);assert.equal(staff[1].active,false);
 authFails=false;await saveStaffAccount(payload,owner);assert.equal(accounts.length,1);assert.equal(staff.length,2);assert.equal(users.length,1);assert.equal(accounts[0].active,true);assert.equal(staff[1].active,true);
 await saveStaffAccount(payload,owner);assert.equal(users.length,1);assert.equal(staff.length,2);assert.equal(hours.filter(h=>h.staff_id===newStaffId).length,1);
});
test('existing owners and another staff assignment cannot be overwritten',async()=>{
 accounts=[{email,role:'owner',staff_id:null,active:true}];await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===409);
 accounts=[{email,role:'barber',staff_id:'barber-2',active:true}];await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===409);
 assert.ok(!calls.some(c=>c.method!=='GET'));
});
test('account list exposes Auth persistence only for the corresponding barber emails',async()=>{
 accounts=[{email,role:'barber',staff_id:'barber-1',active:true}];users=[{email,id:uid},{email:'unrelated@example.com',id:'private-user-id'}];
 const result=await readStaffAccounts(owner);assert.equal(result.accounts[0].authUserId,uid);assert.ok(!JSON.stringify(result).includes('unrelated@example.com'));assert.ok(!JSON.stringify(result).includes('private-user-id'));
});
test('disabled staff cannot log in and tokens for a different email are rejected',async()=>{
 accounts=[{email,role:'barber',staff_id:'barber-1',active:false}];await assert.rejects(()=>staffPasswordLogin(email,'test-password'),e=>e.status===401);assert.ok(!calls.some(c=>c.url.pathname==='/auth/v1/token'));
 accounts[0].active=true;wrongToken=true;await assert.rejects(()=>staffPasswordLogin(email,'test-password'),e=>e.status===401);
 wrongToken=false;const result=await staffPasswordLogin(email,'test-password');assert.equal(result.manager.staff_id,'barber-1');assert.equal(calls.at(-1).body.email,email);
});
test('access toggle never promotes owners and cannot activate a missing Auth identity',async()=>{
 accounts=[{email,role:'owner',staff_id:null,active:true}];await assert.rejects(()=>setEmailStaffAccess({email,active:false},owner),e=>e.status===404);
 accounts=[{email,role:'barber',staff_id:'barber-1',active:false}];await assert.rejects(()=>setEmailStaffAccess({email,active:true},owner),e=>e.status===409);
 users=[{id:uid,email}];await setEmailStaffAccess({email,active:true},owner);assert.equal(accounts[0].active,true);await setEmailStaffAccess({email,active:false},owner);assert.equal(accounts[0].active,false);
});
test('legacy username accounts can still authenticate with their existing identity',async()=>{const legacy='demeter.tamas@staff.demeters.invalid';accounts=[{email:legacy,role:'barber',staff_id:'barber-1',active:true}];const result=await staffPasswordLogin('demeter.tamas','existing-password');assert.equal(result.session.user.email,legacy);assert.equal(result.manager.staff_id,'barber-1')});
test('failed Auth readback never activates permissions and retry reuses the created user',async()=>{missingReadback=true;await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===503);assert.equal(accounts[0].active,false);assert.equal(users.length,1);missingReadback=false;await saveStaffAccount(input,owner);assert.equal(accounts[0].active,true);assert.equal(users.length,1)});
test('new staff reservation can be resumed even if manager row creation failed',async()=>{staff.push({id:newStaffId,name:'Pending barber',active:false});const listing=await readStaffAccounts(owner);assert.equal(listing.staff.find(s=>s.id===newStaffId).pendingSetup,true);await saveStaffAccount({...input,createStaff:true,staffId:newStaffId},owner);assert.equal(staff.length,2);assert.equal(staff[1].active,true);assert.equal(accounts[0].staff_id,newStaffId)});
test('new barber validates identity and working-hours template before any mutation',async()=>{
 await assert.rejects(()=>saveStaffAccount({...input,staffId:'barber-1',createStaff:true},owner),e=>e.status===400);
 await assert.rejects(()=>saveStaffAccount({...input,staffId:newStaffId,createStaff:true,copyHoursFrom:'missing-staff'},owner),e=>e.status===404);
 assert.ok(!calls.some(c=>c.method!=='GET'));
});
test('calendar keeps equally sized cards and aligned half-hour stack positions',()=>{
 const records=[{id:'a',starts_at:'09:00',duration:15},{id:'b',starts_at:'09:00',duration:60},{id:'c',starts_at:'09:30',duration:30}];
 const minuteOf=s=>Number(s.slice(0,2))*60+Number(s.slice(3));const layout=buildCalendarLayout(['2026-11-16','2026-11-17'],new Map([['2026-11-16',records]]),8,21,minuteOf);
 assert.equal(CALENDAR_CARD_HEIGHT,76);assert.ok(layout.positions.get('b')-layout.positions.get('a')>=CALENDAR_CARD_HEIGHT+8);assert.ok(layout.positions.get('c')>=layout.positions.get('b')+CALENDAR_CARD_HEIGHT);assert.equal(layout.rows[2].top,layout.position(9*60));
});
