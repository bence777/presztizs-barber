import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY='sb_secret_service_tests';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_tests';
const {validateService,saveService,saveSettings}=await import('../lib/server/staffSettings.js');
const manager={role:'barber',staff_id:'staff-one',bearer:'verified-staff',adminDevice:'A'.repeat(43)};
const service={name:'Hajfestés',description:'Egyéni szolgáltatás',price_huf:15000,duration_minutes:90,sort_order:0,active:true,counts_as_haircut:false};
let calls=[];
const originalFetch=globalThis.fetch;
test.beforeEach(()=>{calls=[];globalThis.fetch=async(raw,options)=>{
 const url=new URL(raw),body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});
 return {ok:true,status:200,text:async()=>JSON.stringify([{id:body?.id||'service-one',...body}])};
}});
test.after(()=>{globalThis.fetch=originalFetch});
test('services accept custom positive integer minutes and validate currency',()=>{
 assert.equal(validateService({...service,duration_minutes:37}).duration_minutes,37);
 for(const value of [0,-1,1.5,NaN,'90'])assert.throws(()=>validateService({...service,duration_minutes:value}),e=>e.status===400);
 for(const value of [-1,1.5,2147483648])assert.throws(()=>validateService({...service,price_huf:value}),e=>e.status===400);
});
test('service creation pins ownership server-side and forwards the manager device and JWT',async()=>{
 const result=await saveService(manager,{...service,staffId:'staff-one',staff_id:'staff-two'});
 assert.equal(result.staff_id,'staff-one');assert.equal(calls[0].options.headers.Authorization,'Bearer verified-staff');
 assert.equal(calls[0].options.headers['X-Demeters-Admin-Device'],manager.adminDevice);
 assert.equal(calls[0].body.duration_minutes,90);
});
test('cross-staff service mutations fail before any database call',async()=>{
 await assert.rejects(()=>saveService(manager,{...service,staffId:'staff-two'}),e=>e.status===403);
 assert.equal(calls.length,0);
});
test('service archive retains rows and scopes the update to the owner',async()=>{
 await saveService(manager,{revision:1,staffId:'staff-one',id:'service-one'},{archive:true});
 assert.equal(calls[0].options.method,'PATCH');assert.equal(calls[0].body.active,false);assert.ok(calls[0].body.archived_at);
 assert.equal(calls[0].url.searchParams.get('staff_id'),'eq.staff-one');
});
test('invalid weekly hours fail before a destructive replacement',async()=>{
 await assert.rejects(()=>saveSettings(manager,{staffId:'staff-one',hours:[{weekday:1,opens:'10:00',closes:'09:00'}]}),e=>e.status===400);
 await assert.rejects(()=>saveSettings(manager,{staffId:'staff-one',hours:[{weekday:1,opens:'09:00',closes:'12:00'},{weekday:1,opens:'11:00',closes:'13:00'}]}),e=>e.status===400);
 assert.equal(calls.length,0);
});

test('a duplicate profile slug reports a profile conflict instead of a booking conflict',async()=>{
 globalThis.fetch=async()=>({ok:false,status:409,text:async()=>JSON.stringify({code:'23505',message:'private internal constraint name'})});
 await assert.rejects(()=>saveSettings(manager,{revision:1,staffId:'staff-one',name:'Own Barber',image_url:'',public_phone:'',booking_step_minutes:15,default_manual_service_id:null,public_slug:'taken-slug'}),e=>e.status===409&&e.code==='slug_taken'&&e.message.includes('profilcím'));
});
