import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicCatalog } from '../lib/server/publicCatalog.js';
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_catalog_test';
const originalFetch=globalThis.fetch;
let mode='ok';const calls=[];
test.beforeEach(()=>{calls.length=0;mode='ok';globalThis.fetch=async raw=>{
 const url=new URL(raw), select=url.searchParams.get('select');calls.push({url,select});
 if(select.includes('public_slug')&&mode!=='ok')return {ok:false,status:mode==='legacy'?400:503,text:async()=>JSON.stringify({code:mode==='legacy'?'42703':'unavailable'})};
 let rows;
 if(url.pathname.endsWith('/booking_staff'))rows=select.includes('public_slug')?[{id:'paliga-zoltan',public_slug:'paliga-zoltan',bio:'Public introduction with enough information for a useful profile.',bio_en:'English public introduction with enough information for a useful profile.',portfolio:[{src:'/images/demetertamas.webp',alt:'Work',guest_email:'hidden@example.com'}],social_links:{instagram:'https://instagram.com/example',secret:'no'},email:'private@example.com'}]:[{id:'paliga-zoltan',name:'Paliga Zoltán',active:true,email:'private@example.com'}];
 else rows=select.includes('name_en')?[{id:'service-one',name_en:'Haircut',description_en:''}]:[{id:'service-one',staff_id:'paliga-zoltan',name:'Hajvágás',price_huf:6000,duration_minutes:30,guest_email:'hidden@example.com'}];
 return {ok:true,status:200,text:async()=>JSON.stringify(rows)};
}});
test.after(()=>{globalThis.fetch=originalFetch});
test('public catalog allows only public fields, including nested portfolio data',async()=>{
 const data=await getPublicCatalog(),json=JSON.stringify(data);
 assert.equal(data.services[0].price,6000);assert.equal(data.barbers[0].slug,'paliga-zoltan');
 assert.ok(!/private@example|hidden@example|guest_email|sb_secret|secret/.test(json));
 assert.ok(calls.every(call=>call.select!=='*'&&!call.select.split(',').includes('email')));
});
test('before migration the actual price list still works without creating empty profiles',async()=>{
 mode='legacy';const data=await getPublicCatalog();assert.equal(data.profilesReady,false);assert.equal(data.barbers[0].slug,null);assert.equal(data.services[0].price,6000);
});
test('an outage fails regeneration rather than overwriting good ISR content with an empty price list',async()=>{
 mode='outage';await assert.rejects(()=>getPublicCatalog());
});
