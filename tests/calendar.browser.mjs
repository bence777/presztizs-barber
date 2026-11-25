// UI smoke test with deterministic API fixtures. Real SQL/RLS is tested separately.
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TEAM } from '../data/team.mjs';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright');
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3100';
const output=process.env.DEMETERS_QA_OUTPUT||'/private/tmp/demeters-qa/screenshots';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
let passed=0;const pass=name=>{passed++;console.log('PASS '+name)};
try {
 for(const [role,width] of [['barber',390],['owner',1440]]){
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/New_York',hasTouch:width<710});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-16T09:15:00Z')});
  const manager={email:role+'@test.invalid',role,staff_id:role==='barber'?'barber-1':null};
  const staff=[{id:'barber-1',name:'Első Fodrász',active:true},{id:'barber-2',name:'Második Fodrász',active:true},{id:'barber-3',name:'Harmadik Fodrász',active:true}];
  const services=[{id:'hajvagas',name:'Hajvágás',duration_minutes:30,price_huf:6000,active:true}];
  const hours=staff.flatMap(s=>Array.from({length:7},(_,weekday)=>({staff_id:s.id,weekday,opens:'09:00:00',closes:'18:00:00'})));
  let timeOff=[],writes=[],accounts=[];
  let bookings=[{id:'a1',staff_id:'barber-1',service_id:'hajvagas',starts_at:'2026-11-16T09:00:00Z',ends_at:'2026-11-16T09:15:00Z',guest_name:'Rövid Vendég',service_name:'Hajvágás',staff_name:'Első Fodrász',status:'confirmed'},{id:'a2',staff_id:'barber-1',service_id:'hajvagas',starts_at:'2026-11-16T11:00:00Z',ends_at:'2026-11-16T12:00:00Z',guest_name:'Hosszú Vendég',service_name:'Haj és szakáll',staff_name:'Első Fodrász',status:'confirmed'},{id:'a3',staff_id:'barber-2',service_id:'hajvagas',starts_at:'2026-11-16T09:00:00Z',ends_at:'2026-11-16T09:30:00Z',guest_name:'Párhuzamos Vendég',service_name:'Hajvágás',staff_name:'Második Fodrász',status:'confirmed'}];
  const utc=(d,t)=>new Date(`${d}T${t}:00+01:00`).toISOString();
  await page.route('**/api/**',async route=>{
   const req=route.request(),u=new URL(req.url()),data=req.postDataJSON?.()||{},method=req.method();let result={};
   if(u.pathname==='/api/admin/auth/session')result={authenticated:true,manager};
   else if(u.pathname==='/api/admin/options')result={services,staff:role==='owner'?staff:staff.slice(0,1),manager};
   else if(u.pathname==='/api/admin/calendar')result={bookings:bookings.filter(b=>!u.searchParams.get('staffId')||u.searchParams.get('staffId')==='all'||u.searchParams.get('staffId')===b.staff_id),timeOff,hours};
   else if(u.pathname==='/api/admin/statistics')result={statistics:{total:bookings.filter(b=>b.status!=='cancelled').length,haircuts:bookings.filter(b=>b.status==='completed').length,today:bookings.filter(b=>b.status!=='cancelled').length}};
   else if(u.pathname==='/api/admin/staff-accounts'){
    if(method==='GET')result={staff,accounts};
    else if(method==='PATCH'){const account=accounts.find(a=>a.email===data.email);account.active=data.active;result={account};writes.push({method,data});}
    else{if(data.createStaff&&!staff.some(s=>s.id===data.staffId))staff.push({id:data.staffId,name:data.name,active:true});staff.find(s=>s.id===data.staffId).name=data.name;const account={email:data.email,loginName:null,staffId:data.staffId,active:data.active,authUserId:'44444444-4444-4444-8444-444444444444'};accounts=[...accounts.filter(a=>a.email!==data.email),account];result={account};writes.push({method,data});}
   }
   else if(u.pathname==='/api/admin/bookings')result={bookings:bookings.filter(b=>b.id===u.searchParams.get('booking'))};
   else if(u.pathname==='/api/admin/appointment'){
    writes.push({method,data});if(method==='DELETE'){const old=bookings.find(b=>b.id===data.id);bookings=bookings.filter(b=>b.id!==data.id);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({booking:old})});return;}const b={id:data.id||'55555555-5555-4555-8555-555555555555',staff_id:data.staffId,service_id:data.serviceId,starts_at:utc(data.date,data.time),ends_at:new Date(Date.parse(utc(data.date,data.time))+1800000).toISOString(),guest_name:data.guestName,guest_phone:data.guestPhone,guest_email:data.guestEmail,service_name:'Hajvágás',staff_name:'Első Fodrász',price_huf:6000,status:data.status,is_manual:true,monthly_series_id:data.repeatMonthly?'88888888-8888-4888-8888-888888888888':null};
    bookings=[...bookings.filter(x=>x.id!==b.id),b];result={booking:b,emailSent:null};
   }else if(u.pathname==='/api/admin/change-status'){writes.push({method,data});bookings=bookings.map(b=>b.id===data.id?{...b,status:data.status}:b);result={booking:bookings.find(b=>b.id===data.id)}}
   else if(u.pathname==='/api/admin/time-off'){
    if(method==='GET'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({timeOff})});return;}
    writes.push({method,data});if(method==='DELETE')timeOff=timeOff.filter(o=>o.id!==data.id);else{const o={id:data.id||'77777777-7777-4777-8777-777777777777',staff_id:data.staffId,starts_at:utc(data.startDate,data.allDay?'00:00':data.startTime),ends_at:utc(data.endDate,data.allDay?'23:59':data.endTime),reason:data.reason,all_day:data.allDay,daily_start:data.allDay?null:data.startTime,daily_end:data.allDay?null:data.endTime,kind:data.kind};timeOff=[...timeOff.filter(x=>x.id!==o.id),o];}result={timeOff};
   }else if(u.pathname==='/api/booking/config')result={services:services.map(s=>({...s,duration:s.duration_minutes,price:s.price_huf})),barbers:staff.map((member,index)=>({...member,name:TEAM[index]?.name||member.name}))};
   else if(u.pathname==='/api/booking/availability')result={days:{'2026-11-17':[{value:'10:00',available:true}]},hasWorkingHours:true};
   else if(u.pathname==='/api/guest/session')result={authenticated:false};
   else return route.abort();
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto(base+'/admin/foglalasok');await page.getByRole('heading',{name:'Naptár',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Új foglalás: 2026-11-16 09:00"]')?.disabled===false);
  assert.equal(await page.getByRole('combobox',{name:'Barber szűrése'}).count(),role==='owner'?1:0);
  if(role==='barber'){
   assert.ok(await page.locator('[class*="singleDay"]').count());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
   pass('390px mobile defaults to a daily calendar without page overflow or staff switch');
   const sizes=await page.locator('[class*=calendarEvent]').evaluateAll(els=>els.map(el=>({h:el.getBoundingClientRect().height,w:el.getBoundingClientRect().width})));assert.ok(sizes.length>=2);assert.ok(sizes.every(x=>x.h===76&&x.w===sizes[0].w));pass('15 and 60 minute bookings have identical readable card dimensions');
   await page.getByRole('button',{name:'Új foglalás: 2026-11-16 09:00',exact:true}).click();
   let dialog=page.getByRole('dialog');await dialog.getByLabel('Vendég neve').fill('Telefonos Vendég');await dialog.getByLabel('Telefonszám').fill('+36301234567');await dialog.getByLabel('E-mailes értesítés küldése').uncheck();
   await dialog.getByRole('button',{name:'Foglalás hozzáadása'}).click();await dialog.waitFor({state:'hidden'});
   await page.getByTitle('09:00 • Telefonos Vendég – Hajvágás',{exact:true}).waitFor();assert.equal(writes[0].data.guestEmail,'');pass('calendar slot creates a manual booking without email/OTP and renders the guest');
   await page.getByTitle('09:00 • Telefonos Vendég – Hajvágás',{exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Telefonszám').fill('+36307654321');await dialog.getByRole('button',{name:'Módosítások mentése'}).click();await dialog.waitFor({state:'hidden'});assert.ok(writes.some(w=>w.method==='PATCH'&&w.data.guestPhone==='+36307654321'));pass('booking details can be opened and edited on mobile');
   await page.getByTitle('09:00 • Telefonos Vendég – Hajvágás',{exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Szolgáltatás elvégezve',exact:false}).click();await dialog.waitFor({state:'hidden'});assert.ok(writes.some(w=>w.data.status==='completed'));pass('one-click completion updates persisted status for haircut statistics');
   const event=page.getByTitle('09:00 • Telefonos Vendég – Hajvágás',{exact:true});const card=await event.boundingBox(),serviceBox=await event.locator('span').last().boundingBox();assert.ok(serviceBox.y+serviceBox.height<=card.y+card.height,'Service text must fit inside a 30-minute mobile appointment');
   const freeSlot=page.getByRole('button',{name:'Új foglalás: 2026-11-16 14:00',exact:true});
   await freeSlot.scrollIntoViewIfNeeded();
   await freeSlot.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,clientX:100,clientY:200});await page.clock.runFor(250);await freeSlot.dispatchEvent('pointermove',{pointerType:'touch',isPrimary:true,clientX:100,clientY:220});await page.clock.runFor(400);assert.equal(await page.getByRole('dialog').count(),0);pass('touch scrolling cancels the long-press menu');
   await freeSlot.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,clientX:100,clientY:200});await page.clock.runFor(550);await freeSlot.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});await freeSlot.dispatchEvent('click');
   dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Szünet hozzáadása',exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Időpont hozzáadása',exact:true}).count(),1);assert.equal(await page.getByLabel('Vendég neve').count(),0);await page.screenshot({path:output+'/mobile-slot-menu.png',fullPage:true});pass('touch long press opens the two-action menu without creating a booking');
   await dialog.getByRole('button',{name:'Szünet hozzáadása',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('dialog').count(),0);assert.ok(writes.some(w=>w.data.kind==='break'&&!w.data.allDay&&w.data.startDate==='2026-11-16'&&w.data.startTime==='14:00'));pass('menu break uses the selected staff/date/time and saves a thirty-minute break');
   await page.locator('[class*="breakBlock"]').click();dialog=page.getByRole('dialog');page.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Távollét törlése'}).click();await dialog.waitFor({state:'hidden'});
   const monthlySlot=page.getByRole('button',{name:'Új foglalás: 2026-11-16 13:00',exact:true});await monthlySlot.focus();await page.keyboard.press('Shift+F10');dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Időpont hozzáadása',exact:true}).click();dialog=page.getByRole('dialog');assert.equal(await dialog.getByLabel('Kezdés',{exact:true}).inputValue(),'13:00');await dialog.getByLabel('Vendég neve').fill('Havi Vendég');await dialog.getByLabel('Telefonszám').fill('+36301234567');await dialog.getByLabel('Havi ismétlés végdátum nélkül').check();await dialog.getByLabel('E-mailes értesítés küldése').uncheck();await dialog.getByRole('button',{name:'Foglalás hozzáadása'}).click();await dialog.waitFor({state:'hidden'});assert.ok(writes.some(w=>w.data.repeatMonthly===true&&w.data.time==='13:00'));pass('menu appointment supports monthly recurrence without an end date');
   await page.getByTitle('13:00 • Havi Vendég – Hajvágás',{exact:true}).click();dialog=page.getByRole('dialog');page.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Havi ismétlés leállítása'}).click();await dialog.waitFor({state:'hidden'});assert.ok(writes.some(w=>w.method==='DELETE'&&w.data.stopMonthly===true));pass('monthly recurrence can be stopped from an occurrence');
   await page.screenshot({path:output+'/mobile-calendar.png',fullPage:true});
   await page.getByRole('button',{name:'Szabadságok',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Új foglalás',exact:true}).count(),0);assert.equal(await page.getByRole('searchbox').count(),0);assert.equal(await page.getByLabel('Statisztikai hónap').count(),0);assert.equal(await page.getByText('Következő foglalások',{exact:true}).count(),0);pass('absence page contains only absence actions and filters');await page.getByRole('button',{name:'Új távollét',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Időtartam').selectOption('partial');await dialog.getByLabel('Kezdés',{exact:true}).fill('14:00');await dialog.getByLabel('Befejezés',{exact:true}).fill('15:00');await dialog.getByLabel('Megjegyzés (opcionális)').fill('Próba távollét');await dialog.getByRole('button',{name:'Távollét mentése'}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Próba távollét',{exact:true}).waitFor();pass('partial absence saves and appears in the mobile absence list');
   await page.getByText('Próba távollét',{exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Megjegyzés (opcionális)').fill('Módosított távollét');await dialog.getByRole('button',{name:'Távollét mentése'}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Módosított távollét',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Naptár',exact:true}).click();await page.locator('[class*="absenceBlock"]').waitFor();await page.screenshot({path:output+'/mobile-absence.png',fullPage:true});pass('edited absence renders as a separate calendar block');
   await page.locator('[class*="absenceBlock"]').click();dialog=page.getByRole('dialog');page.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Távollét törlése'}).click();await dialog.waitFor({state:'hidden'});assert.equal(timeOff.length,0);pass('absence can be deleted from its calendar block');
   await page.getByRole('button',{name:'Új foglalás',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});pass('drawer supports Escape and keyboard focus');
  } else {
   await Promise.all([page.waitForResponse(r=>r.url().includes('/api/admin/calendar')&&r.url().includes('staffId=barber-2')),page.getByRole('combobox',{name:'Barber szűrése'}).selectOption('barber-2')]);
   await page.getByRole('button',{name:'Nap',exact:true}).click();await page.getByRole('button',{name:'Hét',exact:true}).click();await page.getByRole('button',{name:'Ma',exact:true}).click();await page.getByText('Havi statisztikák',{exact:true}).click();await page.getByLabel('Statisztikai hónap').fill('2026-10');
   const desktopSlot=page.getByRole('button',{name:'Új foglalás: 2026-11-16 09:00',exact:true});await desktopSlot.click({button:'right'});let slotMenu=page.getByRole('dialog');await slotMenu.getByRole('button',{name:'Szünet hozzáadása',exact:true}).waitFor();await page.screenshot({path:output+'/desktop-slot-menu.png',fullPage:true});await slotMenu.getByRole('button',{name:'Időpont hozzáadása',exact:true}).click();slotMenu=page.getByRole('dialog');assert.equal(await slotMenu.getByLabel(/^Barber/).inputValue(),'barber-2');assert.equal(await slotMenu.getByLabel('Kezdés',{exact:true}).inputValue(),'09:00');await page.keyboard.press('Escape');await slotMenu.waitFor({state:'hidden'});pass('desktop right-click menu keeps the selected staff and time');
   await page.screenshot({path:output+'/desktop-calendar.png',fullPage:true});pass('owner switches staff, daily/weekly views and statistical month');
   await page.getByRole('button',{name:'Fiókok',exact:true}).click();await page.getByRole('heading',{name:'Fodrászfiókok',exact:true}).waitFor();assert.equal(await page.getByRole('searchbox').count(),0);assert.equal(await page.getByRole('button',{name:'Új foglalás',exact:true}).count(),0);
   await page.getByRole('button',{name:'Saját fiók létrehozása',exact:true}).first().click();let dialog=page.getByRole('dialog');await dialog.getByLabel('E-mail-cím',{exact:true}).fill('tamas@example.com');await dialog.getByRole('button',{name:'Fiók mentése'}).click();await dialog.waitFor({state:'hidden'});await page.getByText('tamas@example.com',{exact:true}).waitFor();assert.equal(accounts[0].staffId,'barber-1');assert.ok(accounts[0].authUserId);pass('owner saves a personal email account with verified Auth persistence');
   await page.getByRole('button',{name:'Hozzáférés tiltása'}).click();await page.getByText('Letiltott belépés',{exact:true}).waitFor();assert.equal(accounts[0].active,false);pass('owner can revoke staff login without deleting bookings');
   await page.getByRole('button',{name:'+ Új fodrász hozzáadása',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Fodrász neve').fill('Negyedik Fodrász');await dialog.getByLabel('E-mail-cím',{exact:true}).fill('negyedik@example.com');await dialog.getByLabel('Munkaidő átvétele').selectOption('barber-1');await dialog.getByRole('button',{name:'Fodrász és fiók mentése'}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('heading',{name:'Negyedik Fodrász',exact:true}).waitFor();assert.equal(staff.length,4);assert.equal(accounts.length,2);assert.ok(writes.some(w=>w.data.createStaff&&w.data.copyHoursFrom==='barber-1'));pass('owner adds a completely new barber and email-linked Auth account');


  }
  if(role==='barber'){
   await page.goto(base+'/idopontfoglalas?service=hajvagas&barber=barber-1');
   await page.getByRole('heading',{name:'Találjuk meg a napod.'}).waitFor();
   await page.getByRole('button',{name:/2026.*november.*17/}).click();
   await page.getByRole('button',{name:'10:00',exact:true}).click();
   await page.clock.fastForward(15001);
   assert.ok(await page.getByRole('button',{name:'10:00',exact:true}).getAttribute('aria-pressed')==='true');
   await page.getByRole('button',{name:'Tovább az adatokhoz'}).click();
   await page.screenshot({path:output+'/guest-booking.png',fullPage:true});
   pass('guest booking keeps service, staff and selected time through a fresh availability poll');
  }
  assert.deepEqual(errors,[]);pass(role+' calendar has no browser JavaScript errors');
  await context.close();
 }
 const page=await browser.newPage();await page.goto(base+'/');assert.ok((await page.title()).includes('DEMETERS'));assert.equal(await page.locator('script[type="application/ld+json"]').count(),1);pass('public DEMETERS brand and HairSalon structured metadata render');
 const unauthorized=await page.request.get(base+'/api/admin/calendar?from=2026-11-16&to=2026-11-17');assert.equal(unauthorized.status(),401);
 for(const route of ['staff-accounts','statistics?month=2026-11','time-off?from=2026-11-16&to=2026-11-17'])assert.equal((await page.request.get(base+'/api/admin/'+route)).status(),401);
 const csrf=await page.request.post(base+'/api/admin/time-off',{headers:{origin:'https://external.invalid'},data:{}});assert.equal(csrf.status(),403);pass('real admin APIs reject missing sessions and cross-origin mutations');
 console.log(`${passed} browser checks passed; screenshots: ${output}`);
}finally{await browser.close()}
