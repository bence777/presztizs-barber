import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY='sb_secret_fake_for_tests_only';
const {parseCalendarRange,createAdminAppointment,editAdminAppointment,deleteAdminAppointment}=await import('../lib/server/adminCalendar.js');
const owner={role:'owner',staff_id:null};
const barber={role:'barber',staff_id:'barber-1'};
const bookingId='55555555-5555-4555-8555-555555555555';
const userId='11111111-1111-4111-8111-111111111111';
let booking={id:bookingId,user_id:null,staff_id:'barber-1',service_id:'hajvagas',starts_at:'2026-11-12T09:00:00Z',ends_at:'2026-11-12T09:30:00Z',guest_name:'Próba Vendég',guest_email:'proba@example.com',guest_phone:'06301234567',price_huf:6000,status:'confirmed',is_manual:true,is_demo:true};
let saved=null;
const defaultInput={staffId:'barber-1',serviceId:'hajvagas',date:'2026-11-12',time:'10:30',guestName:'Teszt Vendég',guestEmail:'test@example.com',guestPhone:'+36301234567',status:'confirmed'};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(raw,opts={})=>{
 const u=new URL(raw),table=u.pathname.split('/').pop(),method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):null;
 const service=[{id:'hajvagas',name:'Hajvágás',duration_minutes:30,price_huf:6000}];
 const staff=[{id:'barber-1',name:'Első Barber',email:null}];
 let value=[];
 if(table==='booking_services')value=service;
 if(table==='booking_staff')value=staff;
 if(table==='guest_profiles')value=[];
 if(table==='booking_appointments'){
   if(method==='POST'){saved=body;value=[{id:bookingId,...body}];}
   else if(method==='PATCH'){saved=body;booking={...booking,...body};value=[booking];}
   else if(method==='DELETE'){saved='deleted';value=[{id:bookingId}];}
   else if(u.searchParams.get('guest_email'))value=u.searchParams.get('guest_email')==='eq.linked@example.com'?[{user_id:userId}]:[];
   else value=[booking];
 }
 return {ok:true,status:200,text:async()=>JSON.stringify(value)};
};

test('Calendar dates are validated and interpreted in Europe/Budapest',()=>{
 const r=parseCalendarRange('2026-11-11','2026-11-12');
 assert.equal(r.start,'2026-11-10T23:00:00.000Z');
 assert.equal(r.end,'2026-11-11T23:00:00.000Z');
 assert.throws(()=>parseCalendarRange('2026-02-30','2026-03-02'),/Hibás időszak/);
 assert.throws(()=>parseCalendarRange('2026-01-01','2026-10-01'),/Hibás időszak/);
});
test('Owner can manually create a booking without an auth user',async()=>{
 const item=await createAdminAppointment(defaultInput,owner);
 assert.equal(saved.user_id,null);
 assert.equal(saved.is_manual,true);
 assert.equal(saved.starts_at,'2026-11-12T09:30:00.000Z');
 assert.equal(saved.ends_at,'2026-11-12T10:00:00.000Z');
 assert.equal(saved.price_huf,6000);
 assert.equal(saved.guest_name,'Teszt Vendég');
 assert.equal(item.service_name,'Hajvágás');
});
test('Existing verified email is linked to earlier auth user ID',async()=>{
 await createAdminAppointment({...defaultInput,guestEmail:'linked@example.com'},owner);
 assert.equal(saved.user_id,userId);
});
test('Barber cannot create an appointment for another barber',async()=>{
 await assert.rejects(()=>createAdminAppointment({...defaultInput,staffId:'barber-2'},barber),e=>e.status===403);
});
test('Editor preserves demo marker and shifts end time to selected service duration',async()=>{
 const item=await editAdminAppointment(bookingId,{...defaultInput,guestEmail:'proba@example.com',date:'2026-11-16',time:'13:00'},owner);
 assert.equal(saved.is_demo,undefined);
 assert.equal(saved.is_manual,true);
 assert.equal(saved.ends_at,'2026-11-16T12:30:00.000Z');
 assert.equal(item.guest_name,'Teszt Vendég');
});
test('Delete operation removes appointment by ID',async()=>{
 const deleted=await deleteAdminAppointment(bookingId,owner);
 assert.equal(saved,'deleted');
 assert.equal(deleted.id,bookingId);
});
test.after(()=>{globalThis.fetch=originalFetch});
