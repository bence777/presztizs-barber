import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY='sb_secret_fake_test';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fake_test';
const {readCalendar,createAdminAppointment,editAdminAppointment,deleteAdminAppointment,readStatistics}=await import('../lib/server/adminCalendar.js');
const {timeOffPayload,expandTimeOff,mutateTimeOff,readTimeOff}=await import('../lib/server/timeOff.js');
const {bookingDbRows,getMonthAvailability}=await import('../lib/server/bookingDb.js');
const {scopedStaff}=await import('../lib/server/bookingManagement.js');
const barber={role:'barber',staff_id:'barber-1',bearer:'verified-staff-jwt',adminDevice:'A'.repeat(43)};
const owner={role:'owner',staff_id:null,bearer:'verified-owner-jwt'};
const id='55555555-5555-4555-8555-555555555555';
const originalFetch=globalThis.fetch;
let calls=[],off=[],existing=[],hours=[{opens:'09:00:00',closes:'12:00:00'},{opens:'13:00:00',closes:'18:00:00'}],paging=false;
const service={id:'hajvagas',name:'Hajvágás',duration_minutes:30,price_huf:6000,active:true};
const input={staffId:'barber-1',serviceId:'hajvagas',date:'2026-11-20',time:'10:00',guestName:'Telefonos Vendég',guestPhone:'+36301234567',guestEmail:''};
globalThis.fetch=async(raw,opts)=>{
 const url=new URL(raw),table=url.pathname.split('/').pop(),method=opts.method,body=opts.body&&JSON.parse(opts.body);calls.push({table,url,method,body,headers:opts.headers});
 let data=[];
 if(table==='booking_services')data=[service];
 if(table==='booking_staff')data=[{id:'barber-1',name:'Paliga Zoltán',active:true}];
 if(table==='booking_hours')data=hours;
 if(table==='booking_time_off')data=method==='GET'?off:method==='DELETE'?[{id}]:[{id,...body}];
 if(table==='booking_statistics')data={total:12,haircuts:3,today:2,month:'2026-11'};
 if(table==='booking_create_monthly')data=[{id,...body.p_booking,monthly_series_id:'77777777-7777-4777-8777-777777777777'}];
 if(table==='booking_appointments'){
  if(method==='GET')data=paging?(Number(url.searchParams.get('offset'))===0?Array.from({length:500},(_,i)=>({id:String(i)})):[{id:'501'}]):existing.filter(b=>(!url.searchParams.get('staff_id')||url.searchParams.get('staff_id')===`eq.${b.staff_id}`)&&(!url.searchParams.get('id')||url.searchParams.get('id')===`eq.${b.id}`));
  else data=[{id,...body}];
 }
 return {ok:true,status:200,text:async()=>JSON.stringify(data)};
};
test.beforeEach(()=>{calls=[];off=[];existing=[];paging=false;hours=[{opens:'09:00:00',closes:'12:00:00'},{opens:'13:00:00',closes:'18:00:00'}]});
test.after(()=>{globalThis.fetch=originalFetch});
test('unknown roles, missing staff assignments and injected staff filters fail closed',()=>{
 for(const manager of [null,{role:'admin'},{role:'barber',staff_id:null}])assert.throws(()=>scopedStaff(manager),e=>e.status===403);
 assert.throws(()=>scopedStaff(barber,'barber-2'),e=>e.status===403);
 assert.throws(()=>scopedStaff(owner,'one,staff_id.neq.two'),e=>e.status===400);
});
test('calendar and absence queries are staff scoped and use the staff bearer for RLS',async()=>{
 await readCalendar({manager:barber,from:'2026-11-16',to:'2026-11-23'});
 await readTimeOff(barber,{start:'2026-11-15T23:00Z',end:'2026-11-22T23:00Z'});
 const generation=calls.find(c=>c.table==='booking_materialize_monthly');assert.deepEqual(generation.body,{p_from:'2026-11-16',p_to:'2026-11-23',p_staff:'barber-1'});assert.equal(generation.headers.apikey,'sb_secret_fake_test');
 for(const call of calls.filter(c=>c.table!=='booking_materialize_monthly')){assert.equal(call.url.searchParams.get('staff_id'),'eq.barber-1');assert.equal(call.headers.Authorization,'Bearer verified-staff-jwt');assert.equal(call.headers.apikey,'sb_publishable_fake_test');assert.equal(call.headers['X-Demeters-Admin-Device'],barber.adminDevice)}
 calls=[];await readCalendar({manager:owner,from:'2026-11-16',to:'2026-11-23'});assert.equal(calls[0].url.searchParams.get('staff_id'),null);
});
test('manual booking needs phone, allows no email/account, and cannot be created during break or outside hours',async()=>{
 await assert.rejects(()=>createAdminAppointment({...input,guestPhone:''},barber),e=>e.status===400);
 await assert.rejects(()=>createAdminAppointment({...input,time:'12:00'},barber),e=>e.code==='hours');
 await assert.rejects(()=>createAdminAppointment({...input,time:'08:30'},barber),e=>e.code==='hours');
 const result=await createAdminAppointment(input,barber);assert.equal(result.user_id,null);assert.equal(result.guest_email,null);assert.equal(result.is_manual,true);
 const write=calls.find(c=>c.method==='POST'&&c.table==='booking_appointments');assert.equal(write.headers.Authorization,'Bearer verified-staff-jwt');
});
test('manual booking checks fresh absence and overlap records before insert',async()=>{
 off=[{staff_id:'barber-1',starts_at:'2026-11-20T08:00Z',ends_at:'2026-11-20T10:00Z'}];
 await assert.rejects(()=>createAdminAppointment(input,barber),e=>e.code==='leave');assert.equal(calls.filter(c=>c.method==='POST').length,0);
 off=[];existing=[{id,staff_id:'barber-1',starts_at:'2026-11-20T09:00Z',ends_at:'2026-11-20T09:30Z'}];
 await assert.rejects(()=>createAdminAppointment(input,barber),e=>e.code==='overlap');
});
test('monthly creation uses an atomic RPC with the manager identity and rejects invalid recurrence options',async()=>{
 const item=await createAdminAppointment({...input,repeatMonthly:true},barber);
 assert.ok(item.monthly_series_id);
 const write=calls.find(c=>c.table==='booking_create_monthly');
 assert.equal(write.headers.Authorization,'Bearer verified-staff-jwt');
 assert.equal(write.headers['X-Demeters-Admin-Device'],barber.adminDevice);
 assert.equal(write.body.p_booking.staff_id,barber.staff_id);
 assert.equal(write.body.p_booking.starts_at,'2026-11-20T09:00:00.000Z');
 assert.equal(calls.some(c=>c.table==='booking_appointments'&&c.method==='POST'),false);
 await assert.rejects(()=>createAdminAppointment({...input,repeatMonthly:'true'},barber),e=>e.code==='invalid_repeat');
 await assert.rejects(()=>createAdminAppointment({...input,repeatMonthly:true,status:'cancelled'},barber),e=>e.code==='invalid_repeat');
});
test('barber cannot edit or delete another staff booking even with its known ID',async()=>{
 existing=[{id,staff_id:'barber-2'}];
 await assert.rejects(()=>editAdminAppointment(id,input,barber),e=>e.status===404);
 await assert.rejects(()=>deleteAdminAppointment(id,barber),e=>e.status===404);
 assert.equal(calls.filter(c=>c.method!=='GET').length,0);
});
test('monthly statistics are a database aggregate scoped independently of calendar rows',async()=>{
 assert.deepEqual(await readStatistics(barber,'2026-11'),{total:12,haircuts:3,today:2,month:'2026-11'});
 assert.deepEqual(calls.find(c=>c.table==='booking_statistics').body,{p_month:'2026-11-01',p_staff:'barber-1'});
 await assert.rejects(()=>readStatistics(barber,'2026-11','barber-2'),e=>e.status===403);
 await assert.rejects(()=>readStatistics(owner,'2026-13'),e=>e.status===400);
});
test('all-day absence includes ending day and handles Budapest DST',()=>{
 const body=timeOffPayload({staffId:'barber-1',startDate:'2026-03-29',endDate:'2026-03-29',allDay:true},barber);
 assert.equal(body.starts_at,'2026-03-28T23:00:00.000Z');assert.equal(body.ends_at,'2026-03-29T22:00:00.000Z');
 assert.equal(Date.parse(body.ends_at)-Date.parse(body.starts_at),23*3600000);
});
test('partial multi-day absences expand daily instead of blocking all intermediate working hours',()=>{
 const body=timeOffPayload({staffId:'barber-1',startDate:'2026-11-18',endDate:'2026-11-20',allDay:false,startTime:'14:00',endTime:'15:00'},barber);
 const expanded=expandTimeOff([body],'2026-11-01','2026-12-01');assert.equal(expanded.length,3);
 assert.equal(expanded[1].starts_at,'2026-11-19T13:00:00.000Z');assert.equal(expanded[1].ends_at,'2026-11-19T14:00:00.000Z');
 assert.throws(()=>timeOffPayload({staffId:'barber-1',startDate:'2026-02-30',endDate:'2026-03-01',allDay:true},barber));
 assert.throws(()=>timeOffPayload({staffId:'barber-2',startDate:'2026-11-18',endDate:'2026-11-20',allDay:true},barber),e=>e.status===403);
});
test('absence update and delete keep staff scope and bearer on write',async()=>{
 await mutateTimeOff('PATCH',{id,staffId:'barber-1',startDate:'2026-11-18',endDate:'2026-11-18',allDay:true},barber);
 await mutateTimeOff('DELETE',{id},barber);
 for(const call of calls){assert.equal(call.url.searchParams.get('staff_id'),'eq.barber-1');assert.equal(call.headers.Authorization,'Bearer verified-staff-jwt')}
});
test('calendar queries paginate past PostgREST caps rather than hiding occupied time',async()=>{
 paging=true;const rows=await bookingDbRows('booking_appointments',{bearer:barber.bearer,query:{select:'id',order:'id'}});assert.equal(rows.length,501);assert.equal(calls.length,2);assert.equal(calls[1].url.searchParams.get('offset'),'500');
});
test('online availability blocks new partial absences and restores slots after deletion',async()=>{
 hours=[{staff_id:'barber-1',weekday:5,opens:'09:00:00',closes:'18:00:00'}];
 off=[{staff_id:'barber-1',starts_at:'2026-11-20T13:00Z',ends_at:'2026-11-22T14:00Z',daily_start:'14:00:00',daily_end:'15:00:00'}];
 const args={serviceId:'hajvagas',barberId:'barber-1',month:'2026-11',now:Date.parse('2026-11-19T06:00Z'),freshMetadata:true};
 const before=await getMonthAvailability(args);assert.ok(!before.days['2026-11-20'].some(s=>s.value==='14:00'));assert.ok(before.days['2026-11-20'].some(s=>s.value==='13:30'));
 off=[];const after=await getMonthAvailability(args);assert.ok(after.days['2026-11-20'].some(s=>s.value==='14:00'));
});
