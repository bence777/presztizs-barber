// Explicit opt-in server-side fixtures for local QA only. Never load in production.
// NODE_OPTIONS=--require=./tests/fixtures/public-seo-fetch.cjs
const names = [['paliga-zoltan','Paliga Zoltán'],['kovacs-tibi','Kovács Tibi'],['nehez-zsiros-bence','Nehéz Zsíros Bence'],['toth-dominik','Tóth Dominik'],['hunyadi-robert','Hunyadi Róbert'],['pelles-zsombor','Pelles Zsombor']];
const staff=names.map(([id,name],index)=>({id,name,role:'Barber',image_url:null,public_phone:null,booking_step_minutes:15,active:true,public_slug:id,bio:index<2?'Ez egy kizárólag helyi teszteléshez használt, nem éles fodrászbemutatkozás.':'',bio_en:index<2?'This is a public biography fixture used only in local automated tests, never in production.':'',specializations:[],specializations_en:[],portfolio:[],social_links:{},public_updated_at:index<2?'2026-11-27T10:00:00.000Z':null}));
const services=staff.flatMap((member,index)=>[
 {id:`cut-${member.id}`,staff_id:member.id,name:'Hajvágás',name_en:'Haircut',description:'',description_en:'',duration_minutes:30,price_huf:6000+index*500,active:true,archived_at:null},
 {id:`combo-${member.id}`,staff_id:member.id,name:'Haj és szakáll',name_en:'Hair and beard',description:'',description_en:'',duration_minutes:60,price_huf:8000+index*500,active:true,archived_at:null},
]);
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url||input.href);
 if(!url.hostname.endsWith('.supabase.co'))return originalFetch(input,options);
 if(options.method&&options.method!=='GET')throw new Error('Local SEO QA forbids all database mutations');
 const table=url.pathname.split('/').at(-1);
 let rows=table==='booking_staff'?staff:table==='booking_services'?services:table==='booking_staff_slug_history'?[{slug:'previous-paliga',staff_id:'paliga-zoltan'}]:null;
 if(!rows)throw new Error('Unexpected database access in local SEO QA: '+table);
 for(const field of ['id','slug','active','staff_id']){const filter=url.searchParams.get(field);if(filter?.startsWith('eq.'))rows=rows.filter(row=>String(row[field])===filter.slice(3));}
 const select=url.searchParams.get('select');
 if(select&&select!=='*')rows=rows.map(row=>Object.fromEntries(select.split(',').map(key=>[key,row[key]??null])));
 return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
};
