import os from 'node:os';
import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright');
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3100';
const output=`${os.tmpdir()}/demeters-qa/responsive-v2`;await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
let checks=0;
const pass=name=>{checks++;console.log('PASS '+name)};
try {
 for(const width of [320,360,390,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<711,hasTouch:width<711,timezoneId:'Europe/Budapest'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-16T09:15Z')});
  let authenticated=true,role='owner';
  const staff=[{id:'barber-1',name:'Demeter Tamás',active:true},{id:'barber-2',name:'Fodrász 2',active:true},{id:'barber-3',name:'Fodrász 3',active:true}];
  const bookings=[15,30,60].map((duration,i)=>({id:'booking-'+i,staff_id:'barber-'+(i+1),service_id:'cut-barber-'+(i+1),starts_at:'2026-11-16T09:00Z',ends_at:new Date(Date.parse('2026-11-16T09:00Z')+duration*60000).toISOString(),guest_name:['Telefonos Vendég','Hosszabb Nevű Vendég','Harmadik Vendég'][i],service_name:'Hajvágás és szakálligazítás',staff_name:staff[i].name,status:'confirmed',price_huf:6000}));
  const services=staff.map(member=>({id:'cut-'+member.id,staff_id:member.id,name:'Hajvágás',duration_minutes:30,price_huf:6000,active:true}));
  const manager=()=>({role,staff_id:role==='owner'?null:'barber-1'});
  await page.route('**/api/admin/**',async route=>{
   const u=new URL(route.request().url());let result={};
   if(u.pathname.endsWith('/auth/session'))result={authenticated,manager:authenticated?manager():null};
   else if(u.pathname.endsWith('/auth/password')){authenticated=true;role='barber';result={ok:true,manager:manager()}}
   else if(u.pathname.endsWith('/options'))result={manager:manager(),staff:role==='owner'?staff:staff.slice(0,1),services};
   else if(u.pathname.endsWith('/calendar'))result={bookings:role==='owner'?bookings:bookings.slice(0,1),timeOff:[],hours:staff.flatMap(s=>Array.from({length:7},(_,weekday)=>({staff_id:s.id,weekday,opens:'09:00',closes:'18:00'})))};
   else if(u.pathname.endsWith('/time-off'))result={timeOff:[]};
   else if(u.pathname.endsWith('/statistics'))result={statistics:{total:3,haircuts:0,today:3}};
   else if(u.pathname.endsWith('/staff-accounts'))result={staff,accounts:[]};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  const noOverflow=async label=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${width}px ${label}: horizontal page overflow`)};
  const nav=()=>page.getByRole('navigation',{name:width<711?'Mobil kezelőfelület':'Kezelőfelület',exact:true});
  await page.goto(base+'/admin/foglalasok');await page.getByRole('heading',{name:'Naptár',exact:true}).waitFor();await page.getByTitle(/Telefonos Vendég/).waitFor();await noOverflow('calendar');
  const sizes=await page.locator('[class*=calendarEvent]').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width,top:n.getBoundingClientRect().top})));
  assert.equal(sizes.length,3);assert.ok(Math.abs(sizes[1].height/sizes[0].height-2)<.01);assert.ok(Math.abs(sizes[2].height/sizes[0].height-4)<.01);assert.equal(sizes[1].top,sizes[0].top);pass(`${width}px proportional 15/30/60 minute events and parallel staff lanes`);
  await page.getByRole('button',{name:'Hét',exact:true}).click();await noOverflow('week');assert.ok(await page.locator('[class*=timeCalendar]').evaluate(el=>el.scrollWidth>el.clientWidth));
  if([320,390,768,1440].includes(width))await page.screenshot({path:`${output}/${width}-calendar.png`,fullPage:true});
  await nav().getByRole('button',{name:'Szabadságok',exact:true}).click();await page.getByRole('heading',{name:'Szabadságok',exact:true}).waitFor();await noOverflow('absence');
  assert.equal(await page.getByRole('button',{name:'Új foglalás',exact:true}).count(),0);assert.equal(await page.getByRole('searchbox').count(),0);assert.equal(await page.getByLabel('Státusz szűrése').count(),0);assert.equal(await page.getByText('Havi statisztikák',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Új távollét',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.waitFor();await noOverflow('absence form');const box=await dialog.boundingBox();assert.ok(box.width<=width);
  assert.ok(await dialog.locator('input,select,textarea').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().right<=innerWidth+1&&el.getBoundingClientRect().left>=0)));
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});if([320,390,768,1440].includes(width))await page.screenshot({path:`${output}/${width}-absence.png`,fullPage:true});pass(`${width}px absence-only controls and usable date form`);
  await nav().getByRole('button',{name:'Foglalások',exact:true}).click();await page.getByRole('table').waitFor();await noOverflow('booking list');assert.equal(await page.getByText('Havi statisztikák',{exact:true}).count(),0);pass(`${width}px responsive booking list`);
  await nav().getByRole('button',{name:'Fiókok',exact:true}).click();await page.getByRole('heading',{name:'Fodrászfiókok',exact:true}).waitFor();await page.getByRole('button',{name:'Saját fiók létrehozása'}).first().waitFor();await noOverflow('accounts');
  await page.getByRole('button',{name:'Saját fiók létrehozása'}).first().click();dialog=page.getByRole('dialog');await noOverflow('account form');assert.ok((await dialog.boundingBox()).width<=width);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'+ Új fodrász hozzáadása',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('E-mail-cím',{exact:true}).fill('new@example.com');await noOverflow('new barber form');assert.ok((await dialog.boundingBox()).width<=width);if([390,1440].includes(width))await dialog.screenshot({path:`${output}/${width}-new-barber.png`,animations:'disabled'});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});pass(`${width}px email account management and new barber form`);
  authenticated=false;await page.reload();await page.getByRole('button',{name:'Jelszavas belépés',exact:true}).click();await page.getByLabel('E-mail-cím',{exact:true}).waitFor();await noOverflow('login');
  await page.getByLabel('E-mail-cím',{exact:true}).fill('tamas@example.com');await page.getByLabel('Jelszó',{exact:true}).fill('Browser-password-2026');await page.getByRole('button',{name:'Bejelentkezés',exact:true}).click();await page.getByRole('heading',{name:'Naptár',exact:true}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Barber szűrése'}).count(),0);assert.equal(await nav().getByRole('button',{name:'Fiókok',exact:true}).count(),0);await noOverflow('staff login');pass(`${width}px personal staff login and owner-only navigation`);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log(`${checks} responsive browser checks passed; ${output}`);
}finally{await browser.close()}
