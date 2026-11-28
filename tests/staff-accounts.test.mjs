import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCalendarLayout} from '../lib/client/calendarLayout.mjs';
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
const {staffAccountEmail,staffLoginEmail,saveStaffAccount,readStaffAccounts,setEmailStaffAccess,staffPasswordLogin,provisionStaffPlaceholders}=await import('../lib/server/staffAccounts.js');
const owner={role:'owner'},barber={role:'barber',staff_id:'barber-1'};
const email='tamas@example.com',uid='11111111-1111-4111-8111-111111111111';
const input={staffRevision:1,revision:1,email,staffId:'barber-1',name:'Demeter Tamás',active:true};
const newStaffId='barber-22222222-2222-4222-8222-222222222222';
let accounts,users,staff,hours,calls,authFails,wrongToken,missingReadback;
const original=globalThis.fetch;
globalThis.fetch=async(raw,options={})=>{
 const url=new URL(raw),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({url,method,body,headers:options.headers});
 const table=url.pathname.split('/').pop();let data=[],ok=true,status=200;
 const match=row=>['email','role','staff_id','id','active'].every(key=>!url.searchParams.get(key)||url.searchParams.get(key)===`eq.${row[key]}`);
 if(table==='booking_save_staff_account'){
  const data=body.p_data,person=staff.find(s=>s.id===data.staffId),original=accounts.find(a=>a.email===(data.previousEmail||data.email));
  if(!person||!original)throw new Error('missing provisioning fixture');
  person.name=data.name;if(data.createStaff)person.active=true;
  if(data.previousEmail){const target=accounts.find(a=>a.email===data.email);if(target){target.active=data.active;accounts=accounts.filter(a=>a!==original);return {ok:true,status:200,text:async()=>JSON.stringify(target)};}original.email=data.email;}
  original.active=data.active;return {ok:true,status:200,text:async()=>JSON.stringify(original)};
 }
 if(url.pathname==='/auth/v1/token')data=wrongToken?{user:{id:uid,email:'someone-else@example.com'},access_token:'x',refresh_token:'r'}:{user:{id:uid,email:body.email},access_token:'staff-token',refresh_token:'staff-refresh'};
 else if(url.pathname.includes('/auth/v1/admin/')){
  if(authFails){ok=false;status=503;data={};}
  else if(method==='GET')data=table==='users'?{users}:missingReadback?null:users.find(u=>u.id===table)||null;
  else if(method==='POST'){data={id:uid,...body};users.push(data);}
  else if(method==='PUT'){const user=users.find(u=>u.id===table);if(!user)throw new Error('missing auth user');Object.assign(user,body);data=user;}
  else {throw new Error('Unexpected Auth mutation');}
 }else if(table==='booking_staff'){
  if(method==='POST'){staff.push({...body});data=[];}
  else if(method==='PATCH')data=staff.filter(match).map(s=>Object.assign(s,body));
  else data=staff.filter(match);
 }else if(table==='booking_hours'){
  if(method==='POST'){for(const h of body)if(!hours.some(e=>JSON.stringify(e)===JSON.stringify(h)))hours.push(h);data=[];}
  else data=hours.filter(match);
 }else if(table==='booking_managers'){
  if(method==='POST'){accounts.push({revision:1,...body});data=[];}
  else if(method==='PATCH')data=accounts.filter(match).map(row=>Object.assign(row,body));
  else data=accounts.filter(match);
 }
 return {ok,status,json:async()=>data,text:async()=>JSON.stringify(data)};
};
test.beforeEach(()=>{accounts=[];users=[];calls=[];staff=[{id:'barber-1',name:'Demeter Tamás',active:true,sort_order:1}];hours=[{staff_id:'barber-1',weekday:1,opens:'09:00:00',closes:'18:00:00'}];authFails=false;wrongToken=false;missingReadback=false});test.after(()=>{globalThis.fetch=original});
test('staff cannot list, create a barber or change any staff login',async()=>{
 for(const f of [()=>readStaffAccounts(barber),()=>saveStaffAccount({...input,createStaff:true,staffId:newStaffId},barber),()=>setEmailStaffAccess({revision:1,email,active:false},barber)])await assert.rejects(f,e=>e.status===403);
 assert.equal(calls.length,0);
});
test('new accounts require a personal email and never generate synthetic addresses',()=>{
 assert.equal(staffAccountEmail(' Tamas@Example.com '),email);
 for(const value of ['demeter.tamas','a@staff.demeters.invalid','bad@','owner,role.eq.owner'])assert.throws(()=>staffAccountEmail(value));
 assert.equal(staffLoginEmail('Tamas@Example.com'),email);
 assert.equal(staffLoginEmail('demeter.tamas'),'demeter.tamas@staff.demeters.invalid');
});
test('retired legacy staff disappear from account management while unfinished new profiles remain',async()=>{
 staff.push({id:'barber-2',name:'Második Barber',active:false},{id:newStaffId,name:'Új Fodrász',active:false});
 accounts.push({revision:1,email:'retired@example.com',staff_id:'barber-2',role:'barber',active:false});
 const result=await readStaffAccounts(owner);
 assert.deepEqual(result.staff.map(s=>s.id),['barber-1',newStaffId]);
 assert.equal(result.staff[1].pendingSetup,true);
 assert.equal(result.accounts.length,0);
 assert.ok(!calls.some(c=>c.url.pathname.includes('/auth/v1/admin/')));
});
test('save creates and reads back the email user in Supabase Auth before activating staff permissions',async()=>{
 const result=await saveStaffAccount({...input,role:'owner'},owner);
 assert.deepEqual(result,{revision:1,loginName:null,email,staffId:'barber-1',active:true,authUserId:uid});
 assert.equal(accounts[0].role,'barber');assert.equal(accounts[0].staff_id,'barber-1');
 const create=calls.find(c=>c.url.pathname==='/auth/v1/admin/users'&&c.method==='POST');assert.equal(create.body.email,email);assert.equal(create.body.email_confirm,false);assert.equal(create.body.password,undefined);assert.equal(create.headers.apikey,'sb_secret_test');
 const readback=calls.findIndex(c=>c.url.pathname===`/auth/v1/admin/users/${uid}`),activation=calls.findIndex(c=>c.url.pathname.endsWith('/booking_save_staff_account')&&c.method==='POST'&&c.body.p_data.active===true);assert.ok(readback>=0&&activation>readback);
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
 accounts=[{revision:1,email,role:'owner',staff_id:null,active:true}];await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===409);
 accounts=[{revision:1,email,role:'barber',staff_id:'barber-2',active:true}];await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===409);
 assert.ok(!calls.some(c=>c.method!=='GET'));
});
test('account list exposes Auth persistence only for the corresponding barber emails',async()=>{
 accounts=[{revision:1,email,role:'barber',staff_id:'barber-1',active:true}];users=[{email,id:uid},{email:'unrelated@example.com',id:'private-user-id'}];
 const result=await readStaffAccounts(owner);assert.equal(result.accounts[0].authUserId,uid);assert.ok(!JSON.stringify(result).includes('unrelated@example.com'));assert.ok(!JSON.stringify(result).includes('private-user-id'));
});
test('disabled staff cannot log in and tokens for a different email are rejected',async()=>{
 accounts=[{revision:1,email,role:'barber',staff_id:'barber-1',active:false}];await assert.rejects(()=>staffPasswordLogin(email,'test-password'),e=>e.status===401);assert.ok(!calls.some(c=>c.url.pathname==='/auth/v1/token'));
 accounts[0].active=true;wrongToken=true;await assert.rejects(()=>staffPasswordLogin(email,'test-password'),e=>e.status===401);
 wrongToken=false;const result=await staffPasswordLogin(email,'test-password');assert.equal(result.manager.staff_id,'barber-1');assert.equal(calls.at(-1).body.email,email);
});
test('access toggle never promotes owners and cannot activate a missing Auth identity',async()=>{
 accounts=[{revision:1,email,role:'owner',staff_id:null,active:true}];await assert.rejects(()=>setEmailStaffAccess({revision:1,email,active:false},owner),e=>e.status===404);
 accounts=[{revision:1,email,role:'barber',staff_id:'barber-1',active:false}];await assert.rejects(()=>setEmailStaffAccess({revision:1,email,active:true},owner),e=>e.status===409);
 users=[{id:uid,email}];await setEmailStaffAccess({revision:1,email,active:true},owner);assert.equal(accounts[0].active,true);await setEmailStaffAccess({revision:1,email,active:false},owner);assert.equal(accounts[0].active,false);
});
test('legacy username accounts can still authenticate with their existing identity',async()=>{const legacy='demeter.tamas@staff.demeters.invalid';accounts=[{revision:1,email:legacy,role:'barber',staff_id:'barber-1',active:true}];const result=await staffPasswordLogin('demeter.tamas','existing-password');assert.equal(result.session.user.email,legacy);assert.equal(result.manager.staff_id,'barber-1')});
test('failed Auth readback never activates permissions and retry reuses the created user',async()=>{missingReadback=true;await assert.rejects(()=>saveStaffAccount(input,owner),e=>e.status===503);assert.equal(accounts[0].active,false);assert.equal(users.length,1);missingReadback=false;await saveStaffAccount(input,owner);assert.equal(accounts[0].active,true);assert.equal(users.length,1)});
test('new staff reservation can be resumed even if manager row creation failed',async()=>{staff.push({id:newStaffId,name:'Pending barber',active:false});const listing=await readStaffAccounts(owner);assert.equal(listing.staff.find(s=>s.id===newStaffId).pendingSetup,true);await saveStaffAccount({...input,createStaff:true,staffId:newStaffId},owner);assert.equal(staff.length,2);assert.equal(staff[1].active,true);assert.equal(accounts[0].staff_id,newStaffId)});
test('new barber validates identity and working-hours template before any mutation',async()=>{
 await assert.rejects(()=>saveStaffAccount({...input,staffId:'barber-1',createStaff:true},owner),e=>e.status===400);
 await assert.rejects(()=>saveStaffAccount({...input,staffId:newStaffId,createStaff:true,copyHoursFrom:'missing-staff'},owner),e=>e.status===404);
 assert.ok(!calls.some(c=>c.method!=='GET'));
});
test('calendar uses actual duration and separate lanes for simultaneous staff bookings',()=>{
 const minuteOf=iso=>{const [h,m]=iso.slice(11,16).split(':').map(Number);return h*60+m};
 const bookings=[{id:'a',starts_at:'2026-11-16T09:00Z',ends_at:'2026-11-16T09:45Z'},{id:'b',starts_at:'2026-11-16T09:00Z',ends_at:'2026-11-16T10:30Z'},{id:'c',starts_at:'2026-11-16T10:30Z',ends_at:'2026-11-16T11:00Z'}];
 const layout=buildCalendarLayout(['day'],new Map([['day',bookings]]),8,18,minuteOf);
 assert.equal(layout.events.get('b').height,layout.events.get('a').height*2);
 assert.equal(layout.events.get('a').top,layout.events.get('b').top);
 assert.notEqual(layout.events.get('a').left,layout.events.get('b').left);
 assert.equal(layout.events.get('c').top,layout.position(630));
});


test('placeholder provisioning is explicit, idempotent and never sends mail or creates passwords',async()=>{
 const preview=await provisionStaffPlaceholders(owner);assert.equal(preview[0].email,'barber-1@pending.demeters.invalid');assert.equal(users.length,0);assert.equal(accounts.length,0);
 const created=await provisionStaffPlaceholders(owner,{apply:true});assert.equal(created[0].isPlaceholder,true);assert.equal(created[0].active,false);assert.equal(created[0].authUserId,uid);
 assert.equal(accounts[0].role,'barber');assert.equal(accounts[0].staff_id,'barber-1');assert.equal(accounts[0].active,false);
 const user=users[0];assert.equal(user.email_confirm,false);assert.equal(user.password,undefined);assert.equal(user.app_metadata.demeters_staff_id,'barber-1');
 await provisionStaffPlaceholders(owner,{apply:true});assert.equal(users.length,1);assert.equal(accounts.length,1);
 assert.ok(!calls.some(c=>/otp|invite|generate_link/.test(c.url.pathname)));
 await assert.rejects(()=>setEmailStaffAccess({email:user.email,active:true},owner),e=>e.status===409);
});

test('an existing personal staff account is never replaced by a placeholder',async()=>{
 accounts=[{revision:1,email,role:'barber',staff_id:'barber-1',active:true}];users=[{id:uid,email}];
 const planned=await provisionStaffPlaceholders(owner,{apply:true});assert.equal(planned.length,0);assert.equal(accounts[0].email,email);assert.equal(accounts[0].active,true);
});

test('owner replaces a placeholder in Auth while retaining the same user and own staff scope',async()=>{
 const staged=(await provisionStaffPlaceholders(owner,{apply:true}))[0];calls=[];
 const result=await saveStaffAccount({...input,previousEmail:staged.email},owner);
 assert.equal(result.email,email);assert.equal(result.authUserId,uid);assert.equal(result.staffId,'barber-1');assert.equal(result.active,true);assert.equal(result.isPlaceholder,undefined);
 assert.equal(users.length,1);assert.equal(users[0].id,uid);assert.equal(users[0].email,email);assert.equal(users[0].email_confirm,false);assert.equal(accounts[0].email,email);
 assert.ok(!calls.some(c=>/otp|invite/.test(c.url.pathname)));assert.ok(!calls.some(c=>c.body?.email_confirm===true));
});

test('replacing a placeholder can link an existing guest without changing guest credentials',async()=>{
 const staged=(await provisionStaffPlaceholders(owner,{apply:true}))[0];const guestId='33333333-3333-4333-8333-333333333333';
 users.push({id:guestId,email,email_confirmed_at:'2026-11-01T00:00Z'});calls=[];
 const result=await saveStaffAccount({...input,previousEmail:staged.email},owner);
 assert.equal(result.authUserId,guestId);assert.equal(accounts[0].email,email);assert.ok(!calls.some(c=>c.url.pathname.includes('/auth/v1/admin/')&&c.method!=='GET'));
});

test('placeholder replacement and provisioning remain owner-only and cannot steal another staff email',async()=>{
 await assert.rejects(()=>provisionStaffPlaceholders(barber,{apply:true}),e=>e.status===403);
 const staged=(await provisionStaffPlaceholders(owner,{apply:true}))[0];accounts.push({email,role:'barber',staff_id:'other-staff',active:true});calls=[];
 await assert.rejects(()=>saveStaffAccount({...input,previousEmail:staged.email},owner),e=>e.status===409);
 assert.ok(!calls.some(c=>c.method!=='GET'));
 await assert.rejects(()=>saveStaffAccount({...input,previousEmail:staged.email},barber),e=>e.status===403);
});
