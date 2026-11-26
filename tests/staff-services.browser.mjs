// Browser checks use intercepted APIs; no real booking, email or production mutation.
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {TEAM} from '../data/team.mjs';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright');
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3108';
const out='/private/tmp/demeters-qa/staff-services';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
let passed=0;const pass=name=>{passed++;console.log('PASS '+name)};
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const manager={role:'barber',staff_id:TEAM[0].id};
  const staff=TEAM.slice(0,2).map(m=>({...m,active:true}));
  let services=staff.map((m,i)=>({id:'service-'+i,staff_id:m.id,name:'Hajvágás',description:i?'Másik fodrász':'Saját szolgáltatás',duration_minutes:i?45:30,price_huf:i?7000:5500,sort_order:0,active:true,counts_as_haircut:true,archived_at:null}));
  let profile={id:staff[0].id,name:staff[0].name,image_url:null,public_phone:'+36301234567',booking_step_minutes:15,default_manual_service_id:'service-0'};
  let hours=[{weekday:1,opens:'09:00',closes:'17:00'}];const writes=[];
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),body=req.postDataJSON(),method=req.method();let result={};
   switch(url.pathname){
    case '/api/admin/auth/session':result={authenticated:true,manager};break;
    case '/api/admin/options':result={services:services.filter(s=>s.staff_id===manager.staff_id),staff:staff.slice(0,1),manager};break;
    case '/api/admin/calendar':result={bookings:[],hours:[],timeOff:[]};break;
    case '/api/admin/statistics':result={statistics:{total:0,haircuts:0,today:0}};break;
    case '/api/admin/services':
     if(method!=='GET'){
      writes.push(body);
      if(method==='POST')services.push({...body,id:'service-color',staff_id:body.staffId,archived_at:null});
      if(method==='PATCH')services=services.map(s=>s.id===body.id?{...s,...body}:s);
      if(method==='DELETE')services=services.map(s=>s.id===body.id?{...s,active:false,archived_at:new Date().toISOString()}:s);
     }
     result={services:services.filter(s=>s.staff_id===manager.staff_id&&!s.archived_at)};break;
    case '/api/admin/settings':
     if(method==='PATCH'){writes.push(body);if(body.hours)hours=body.hours;else profile={...profile,...body};}
     result={profile,hours};break;
    case '/api/booking/config':result={barbers:staff.map((s,i)=>({...s,publicPhone:i?null:profile.public_phone})),services:services.filter(s=>s.active&&!s.archived_at).map(s=>({id:s.id,staffId:s.staff_id,name:s.name,description:s.description,price:s.price_huf,duration:s.duration_minutes}))};break;
    case '/api/guest/session':result={authenticated:false};break;
    default:throw new Error('Unexpected fixture request '+url.pathname);
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  const nav=()=>page.getByRole('navigation',{name:width<711?'Mobil kezelőfelület':'Kezelőfelület',exact:true});
  await page.goto(base+'/admin/foglalasok');await nav().getByRole('button',{name:'Szolgáltatásaim',exact:true}).click();
  await page.getByText('Saját szolgáltatás',{exact:true}).waitFor();assert.equal(await page.getByText('Másik fodrász',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Új szolgáltatás',exact:true}).click();
  await page.getByLabel('Szolgáltatás neve',{exact:true}).fill('Hajfestés');await page.getByLabel('Ár (Ft)',{exact:true}).fill('15000');
  await page.getByRole('button',{name:'90 perc',exact:true}).click();await page.getByRole('button',{name:'Mentés',exact:true}).click();
  await page.getByRole('heading',{name:'Hajfestés',exact:true}).waitFor();assert.equal(writes[0].duration_minutes,90);assert.equal(writes[0].staffId,manager.staff_id);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));pass(`${width}px personal services support adding a 90-minute service without code`);
  await nav().getByRole('button',{name:'Beállítások',exact:true}).click();
  await page.getByLabel(/^Alapértelmezett manuális szolgáltatás/).selectOption('service-color');
  await page.getByLabel(/^Foglalási kezdési lépésköz/).fill('7');await Promise.all([page.waitForResponse(r=>r.url().includes('/api/admin/settings')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Beállítások mentése',exact:true}).click()]);
  await page.getByRole('status').filter({hasText:'Módosítások mentve.'}).waitFor();assert.equal(profile.default_manual_service_id,'service-color');assert.equal(profile.booking_step_minutes,7);
  await page.getByRole('button',{name:'Idősáv hozzáadása',exact:true}).click();
  const hourRows=page.locator('[class*=hourRow]');await hourRows.last().getByLabel(/^Nap/).selectOption('2');
  await page.getByRole('button',{name:'Munkaidő mentése',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent==='Módosítások mentve.');
  await page.screenshot({path:`${out}/settings-${width}.png`,fullPage:true});pass(`${width}px default manual service, independent start interval and weekly hours save`);
  await nav().getByRole('button',{name:'Szolgáltatásaim',exact:true}).click();await page.getByRole('heading',{name:'Hajfestés',exact:true}).waitFor();
  const color=page.locator('article').filter({has:page.getByRole('heading',{name:'Hajfestés',exact:true})});page.once('dialog',d=>d.accept());await color.getByRole('button',{name:'Archiválás',exact:true}).click();await color.waitFor({state:'hidden'});
  await page.goto(base+'/idopontfoglalas');await page.getByRole('heading',{name:'Válassz fodrászt',exact:true}).waitFor();
  assert.equal(await page.getByText('Várható összeg',{exact:true}).count(),0);assert.equal(await page.getByText('A következő',{exact:true}).count(),0);
  const carousel=page.locator('[data-barber-carousel]');await carousel.getByRole('button',{name:staff[0].name,exact:true}).click();
  const active=carousel.locator('article[class*=activeCard]');await active.getByRole('link',{name:'+36301234567',exact:true}).waitFor();
  const tel=active.getByRole('link',{name:'+36301234567',exact:true});assert.equal(await tel.getAttribute('href'),'tel:+36301234567');
  await tel.evaluate(el=>{el.addEventListener('click',e=>e.preventDefault(),{once:true});el.click()});assert.ok(await page.getByRole('heading',{name:'Válassz fodrászt',exact:true}).isVisible());
  assert.ok((await carousel.boundingBox()).y<(width<800?320:520));await page.screenshot({path:`${out}/barbers-${width}.png`,fullPage:true});
  await active.getByRole('button',{name:'IDŐPONTFOGLALÁS',exact:true}).click();
  assert.equal(await page.getByRole('heading',{name:'Hajfestés',exact:true}).count(),0);assert.equal(await page.getByText('Másik fodrász',{exact:true}).count(),0);
  assert.ok((await page.locator('[class*=serviceRow]').innerText()).replace(/\D/g,'').includes('5500'));assert.ok((await page.locator('[class*=serviceRow]').innerText()).includes('30'));
  await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Back to barbers',exact:true}).click();await page.getByRole('heading',{name:'Choose a barber',exact:true}).waitFor();
  assert.ok(await page.getByText('Each barber sets their own prices.',{exact:true}).isVisible());assert.deepEqual(errors,[]);
  pass(`${width}px compact public carousel has linked phone, clickable dots, personal active services, archiving and English labels`);
  await context.close();
 }
 console.log(`${passed} staff-services browser checks passed; ${out}`);
}finally{await browser.close()}
