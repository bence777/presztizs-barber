import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_for_node_tests_only';
const { localToUtcMs, localDay, getMonthAvailability, placeBooking } = await import('../lib/server/bookingDb.js');

const stamp=(date,time)=>new Date(localToUtcMs(date,time)).toISOString();
const rows={
  booking_services: [{id:'hajvagas',name:'Hajvágás',description:'',duration_minutes:45,price_huf:5000,active:true}],
  booking_staff: [{id:'mark',name:'Márk',role:'Barber',image_url:null,active:true}],
  booking_hours: [{staff_id:'mark',weekday:3,opens:'09:00:00',closes:'18:00:00'}],
  booking_time_off: [{staff_id:'mark',starts_at:stamp('2026-11-11','15:00'),ends_at:stamp('2026-11-11','16:00')}],
  booking_appointments: [{staff_id:'mark',starts_at:stamp('2026-11-11','12:00'),ends_at:stamp('2026-11-11','12:45')}],
};
let posts=[];
let rejectInsert=false;
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
  const name=new URL(url).pathname.split('/').at(-1);
  if (options.method === 'POST' && name === 'booking_appointments') {
    posts.push(JSON.parse(options.body));
    if(rejectInsert) return {ok:false,status:409,text:async()=>JSON.stringify({code:'23P01',message:'overlapping appointment'})};
    return {ok:true,status:201,text:async()=>JSON.stringify([{id:'test-booking-id',...posts.at(-1)}])};
  }
  return {ok:true,status:200,text:async()=>JSON.stringify(rows[name]||[])};
};

test('Budapest timezone conversion handles winter and summer time',()=>{
  assert.equal(new Date(localToUtcMs('2026-11-11','11:00')).toISOString(),'2026-11-11T10:00:00.000Z');
  assert.equal(new Date(localToUtcMs('2026-07-11','11:00')).toISOString(),'2026-07-11T09:00:00.000Z');
  assert.equal(localDay(Date.parse('2026-11-11T23:15:00Z')),'2026-11-12');
  assert.equal(localToUtcMs('2026-03-29','02:30'),null);
});

test('Monthly availability uses configured hours, 2h notice and excludes actual bookings and leave',async()=>{
  const {days}=await getMonthAvailability({serviceId:'hajvagas',barberId:'mark',month:'2026-11',now:Date.parse('2026-11-11T08:00:00Z')});
  const times=days['2026-11-11'].map(x=>x.value);
  assert.equal(times.includes('09:00'),false);
  assert.equal(times.includes('11:00'),true);
  assert.equal(times.includes('11:30'),false);
  assert.equal(times.includes('12:00'),false);
  assert.equal(times.includes('12:30'),false);
  assert.equal(times.includes('15:00'),false);
  assert.equal(times.includes('15:30'),false);
  assert.equal(times.includes('16:00'),true);
  assert.equal(days['2026-11-12'],undefined);
});

test('Booking insert locks in price and staff and returns confirmation',async()=>{
  posts=[];rejectInsert=false;
  // This test needs a stable now; use a date comfortably ahead of wall-clock time.
  const farDate = new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  const dow=new Date(`${farDate}T12:00:00Z`).getUTCDay();
  rows.booking_hours.push({staff_id:'mark',weekday:dow,opens:'09:00:00',closes:'18:00:00'});
  const result=await placeBooking({userId:'11111111-1111-4111-8111-111111111111',serviceId:'hajvagas',barberId:'mark',date:farDate,time:'13:00'});
  assert.equal(result.staff_id,'mark');
  assert.equal(posts.length,1);
  assert.equal(posts[0].price_huf,5000);
  assert.equal(posts[0].ends_at,new Date(new Date(posts[0].starts_at).getTime()+45*60000).toISOString());
  rejectInsert=true;
  await assert.rejects(()=>placeBooking({userId:'11111111-1111-4111-8111-111111111111',serviceId:'hajvagas',barberId:'mark',date:farDate,time:'13:00'}),err=>err.status===409);
  globalThis.fetch=originalFetch;
});
