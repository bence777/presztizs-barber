// Local UI fixtures only. SQL/RLS and session renewal are covered by real DB/unit tests.
import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {TEAM} from '../data/team.mjs';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright');
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3108';
const output='/private/tmp/demeters-qa/staff-isolation';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
let checks=0;const pass=message=>{checks++;console.log('PASS '+message)};
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let role='owner',authenticated=true;const writes=[];
  const staff=TEAM.map(s=>({...s,active:true}));
  const services=staff.map((s,i)=>({id:'service-'+i,staff_id:s.id,name:i?'Másik fodrász szolgáltatása':'Saját hajvágás',duration_minutes:30,price_huf:6000,active:true}));
  let accounts=staff.map((s,i)=>({email:`${s.id}@pending.demeters.invalid`,staffId:s.id,active:false,authUserId:`auth-${i}`,isPlaceholder:true}));
  const manager=()=>({role,staff_id:role==='barber'?staff[0].id:null});
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),body=request.postDataJSON(),method=request.method();let result={};
   if(url.pathname==='/api/admin/auth/session')result={authenticated,...(authenticated?{manager:manager()}:{})};
   else if(url.pathname==='/api/admin/options')result={manager:manager(),staff:role==='barber'?staff.slice(0,1):staff,services:role==='barber'?services.slice(0,1):services};
   else if(url.pathname==='/api/admin/calendar')result={bookings:[],timeOff:[],hours:[]};
   else if(url.pathname==='/api/admin/statistics')result={statistics:{total:0,haircuts:0,today:0}};
   else if(url.pathname==='/api/admin/staff-accounts'){
    if(method==='POST'){
     writes.push(body);assert.equal(body.staffId,staff[0].id);assert.equal(body.previousEmail,`${staff[0].id}@pending.demeters.invalid`);assert.equal(body.active,true);
     const account={...accounts[0],email:body.email,active:true,isPlaceholder:false};accounts=[account,...accounts.slice(1)];result={account};
    }else result={staff,accounts};
   }else if(url.pathname==='/api/admin/services'){
    assert.equal(url.searchParams.get('staffId'),staff[0].id);result={services:services.slice(0,1)};
   }else if(url.pathname==='/api/admin/settings')result={profile:{id:staff[0].id,name:staff[0].name,public_phone:null,image_url:null,booking_step_minutes:15,default_manual_service_id:'service-0'},hours:[]};
   else if(url.pathname==='/api/guest/session')result={remembered:false};
   else if(url.pathname==='/api/guest/send-code')result={ok:true};
   else if(url.pathname==='/api/guest/me'){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Jelentkezz be e-mailes kóddal.'})});return;}
   else throw new Error('Unexpected test API '+url.pathname);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  const nav=()=>page.getByRole('navigation',{name:width<711?'Mobil kezelőfelület':'Kezelőfelület',exact:true});
  await page.goto(base+'/admin/foglalasok');await nav().getByRole('button',{name:'Fiókok',exact:true}).click();
  await page.getByRole('button',{name:'Valódi e-mail megadása',exact:true}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Valódi e-mail megadása',exact:true}).count(),6);
  assert.equal(await page.getByRole('button',{name:'Hozzáférés engedélyezése',exact:true}).count(),0);
  await page.getByRole('button',{name:'Valódi e-mail megadása',exact:true}).first().click();
  const dialog=page.getByRole('dialog');assert.equal(await dialog.getByLabel('E-mail-cím',{exact:true}).inputValue(),'');
  assert.equal(await dialog.getByLabel('E-mail-cím',{exact:true}).getAttribute('readonly'),null);
  await dialog.getByLabel('E-mail-cím',{exact:true}).fill('personal@example.com');
  assert.equal(await dialog.getByLabel('Kezdő jelszó (opcionális)',{exact:true}).count(),0);
  await dialog.getByRole('button',{name:'Fiók mentése',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.getByText('personal@example.com',{exact:true}).waitFor();assert.equal(writes.length,1);
  await page.screenshot({path:`${output}/accounts-${width}.png`,fullPage:true});pass(`${width}px six disabled placeholders can be replaced by real email without password or forced verification`);
  role='barber';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'Naptár',exact:true}).waitFor();
  assert.equal(await nav().getByRole('button',{name:'Fiókok',exact:true}).count(),0);assert.equal(await page.getByLabel('Barber szűrése',{exact:true}).count(),0);
  await nav().getByRole('button',{name:'Szolgáltatásaim',exact:true}).click();await page.getByRole('heading',{name:'Saját hajvágás',exact:true}).waitFor();
  assert.equal(await page.getByText('Másik fodrász szolgáltatása',{exact:true}).count(),0);
  assert.equal(await page.getByLabel('Fodrász',{exact:true}).count(),0);
  await nav().getByRole('button',{name:'Beállítások',exact:true}).click();await page.getByLabel('Megjelenített név',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Megjelenített név',{exact:true}).inputValue(),staff[0].name);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));pass(`${width}px permission changes clear the old view; barber sees only own calendar/services/settings and cannot switch staff`);
  authenticated=false;await page.reload();
  await page.getByRole('button',{name:'Jelszavas belépés',exact:true}).click();await page.getByRole('checkbox',{name:/használatonként újabb 7 nap/}).waitFor();
  await page.goto(base+'/foglalasaim');await page.getByLabel('E-MAIL-CÍM',{exact:true}).fill('guest@example.com');await page.getByRole('button',{name:'ELLENŐRZŐ KÓD KÉRÉSE',exact:true}).click();await page.getByRole('checkbox',{name:/használatonként újabb 60 nap/}).waitFor();
  assert.deepEqual(errors,[]);pass(`${width}px admin and guest opt-in labels show the independent sliding 7/60-day lifetime`);
  await context.close();
 }
 console.log(`${checks} staff-isolation browser checks passed; ${output}`);
}finally{await browser.close()}
