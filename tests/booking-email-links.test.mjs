import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
process.env.RESEND_API_KEY = 're_test_only';
process.env.RESEND_FROM = 'Presztízs Barber <test@example.com>';
process.env.NODE_ENV = 'development';
delete process.env.SITE_URL;
delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.VERCEL_URL;
delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

const {bookingSiteUrl, bookingLinks, emailBookingReceipt,emailBookingChange,emailBookingUpdate,emailBookingRemoved} = await import('../lib/server/bookingEmail.js');
const id = '12345678-1234-4234-8234-123456789abc';
const booking = {
  id,staff_id:'barber-1',service_id:'gepi-hajvagas',starts_at:'2026-11-18T13:00:00Z',
  service_name:'Gépi hajvágás',staff_name:'Első Barber',price_huf:5500,
  guest_name:'Teszt Vendég',guest_email:'guest@example.com',status:'confirmed',
};
const requests=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options={}) => {
  if (String(url).includes('booking_staff')) return {ok:true,text:async()=>JSON.stringify([{email:null}])};
  if (String(url) === 'https://api.resend.com/emails') {
    const payload=JSON.parse(options.body);requests.push(payload);
    return {ok:true,text:async()=>JSON.stringify({id:'fake-message'})};
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

test('Locally creates absolute links even without SITE_URL, never relative or missing',()=>{
  assert.equal(bookingSiteUrl(),'http://localhost:3000');
  assert.equal(bookingSiteUrl({NODE_ENV:'development',SITE_URL:'invalid',PORT:'3001'}),'http://localhost:3001');
  assert.deepEqual(bookingLinks(id), {
    guest:`http://localhost:3000/foglalasaim?booking=${id}`,
    staff:`http://localhost:3000/admin/foglalasok?booking=${id}`,
    guestOverview:'http://localhost:3000/foglalasaim',
    staffOverview:'http://localhost:3000/admin/foglalasok',
  });
});

test('Production URL is trusted, HTTPS, and required (no linkless email)',()=>{
  assert.equal(bookingSiteUrl({NODE_ENV:'production'}),null);
  assert.equal(bookingSiteUrl({NODE_ENV:'production',SITE_URL:'http://invalid.example'}),null);
  assert.equal(bookingSiteUrl({NODE_ENV:'production',SITE_URL:'https://barber.example/'}),'https://barber.example');
  assert.equal(bookingSiteUrl({NODE_ENV:'production',SITE_URL:'https://barber.example/?evil=1'}),null);
  assert.equal(bookingSiteUrl({NODE_ENV:'production',VERCEL_URL:'project.vercel.app'}),'https://project.vercel.app');
});

test('New reservation sends BOTH actionable emails and explicit plain-text links',async()=>{
  requests.length=0;
  const sent=await emailBookingReceipt({email:'guest@example.com',name:'Teszt Vendég',booking});
  assert.deepEqual(sent,{guest:true,staff:true});
  assert.equal(requests.length,2);
  const guest=requests.find(x=>x.to[0]==='guest@example.com');
  const barber=requests.find(x=>x.to[0]==='bencebalogh7777@gmail.com');
  assert.ok(guest,'Guest email missing');
  assert.ok(barber,'Barber fallback email missing');
  assert.match(guest.html,/FOGLALÁSOM KEZELÉSE/);
  assert.ok(guest.html.includes(`http://localhost:3000/foglalasaim?booking=${id}`));
  assert.ok(guest.text.includes(`http://localhost:3000/foglalasaim?booking=${id}`));
  assert.match(barber.html,/FOGLALÁS KEZELÉSE/);
  assert.ok(barber.html.includes(`http://localhost:3000/admin/foglalasok?booking=${id}`));
  assert.ok(barber.text.includes(`http://localhost:3000/admin/foglalasok?booking=${id}`));
});

test('Change and edit emails keep the proper deep-links for both people',async()=>{
  requests.length=0;
  const c=await emailBookingChange({booking:{...booking,status:'cancelled'},guestEmail:'guest@example.com',guestName:'Teszt Vendég',changedBy:'guest'});
  const u=await emailBookingUpdate({booking});
  assert.deepEqual(c,{guest:true,staff:true});
  assert.deepEqual(u,{guest:true,staff:true});
  assert.equal(requests.length,4);
  for(const req of requests){
    assert.ok(req.html.includes(req.to[0]==='guest@example.com'?'/foglalasaim?booking=':'/admin/foglalasok?booking='));
  }
});

test('Deleted appointment emails link to existing overview, not deleted event ID',async()=>{
  requests.length=0;
  const sent=await emailBookingRemoved({booking});
  assert.deepEqual(sent,{guest:true,staff:true});
  assert.equal(requests.length,2);
  const guest=requests.find(x=>x.to[0]==='guest@example.com');
  const barber=requests.find(x=>x.to[0]==='bencebalogh7777@gmail.com');
  assert.ok(guest.html.includes('http://localhost:3000/foglalasaim'));
  assert.ok(barber.html.includes('http://localhost:3000/admin/foglalasok'));
  assert.ok(!guest.html.includes('?booking='));
  assert.ok(!barber.html.includes('?booking='));
});

test('Without a trusted production URL no email is sent without a link',async()=>{
  requests.length=0;
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV='production';
  const result=await emailBookingReceipt({email:'guest@example.com',name:'Teszt Vendég',booking});
  process.env.NODE_ENV=previous;
  assert.deepEqual(result,{guest:false,staff:false});
  assert.equal(requests.length,0);
});

test.after(()=>{globalThis.fetch=originalFetch});
