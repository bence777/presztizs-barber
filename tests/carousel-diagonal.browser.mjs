// Mobile touch events and diagonal desktop trackpad gestures; read-only fixtures.
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright');
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3114';
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
let passed=0;const pass=message=>{passed++;console.log('PASS '+message)};
const difference=(a,b,n)=>((b-a+n*1.5)%n)-n/2;
async function phase(page,scope){return page.locator(scope).evaluate(el=>{const cards=[...el.querySelectorAll('article')];const index=cards.findIndex(card=>card.className.includes('activeCard'));const scene=el.querySelector('[aria-roledescription=carousel]');const spacing=parseFloat(getComputedStyle(scene).getPropertyValue('--card-width'))*(scene.clientWidth<600?.76:.7);return {value:index-new DOMMatrixReadOnly(getComputedStyle(cards[index]).transform).m41/spacing,count:cards.length}})}
async function fixture(context){await context.route('**/api/**',route=>{assert.equal(route.request().method(),'GET');if(new URL(route.request().url()).pathname==='/api/booking/config')return route.continue();throw new Error('Unexpected API')})}
try{
 const ctx=await browser.newContext({viewport:{width:390,height:950},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});await fixture(ctx);
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const cdp=await ctx.newCDPSession(page);
 for(const scope of ['#csapat','#foglalas']){
  for(const [dx,dy] of [[-120,-120],[-100,125],[120,100],[100,-125]]){
   await page.goto(base+'/'+scope);await page.reload();const scene=page.locator(scope+' [aria-roledescription=carousel]');await scene.waitFor();await scene.scrollIntoViewIfNeeded();
   const box=await scene.boundingBox(),x=box.x+box.width*.55,y=box.y+box.height*.42;const initial=await phase(page,scope),scroll=await page.evaluate(()=>scrollY);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6}]});await page.waitForTimeout(15)}
   const released=await phase(page,scope);assert.ok(difference(initial.value,released.value,initial.count)*-Math.sign(dx)>.4,'Diagonal drag must follow horizontal displacement');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(180);const coasted=await phase(page,scope);
   assert.ok(difference(released.value,coasted.value,initial.count)*-Math.sign(dx)>.1,`Diagonal release must preserve inertia: ${JSON.stringify({scope,dx,dy,initial,released,coasted,delta:difference(released.value,coasted.value,initial.count)})}`);
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<5,'Diagonal carousel drag must not move the page');
   assert.equal(new URL(page.url()).searchParams.get('barber'),null);pass(`${scope}: diagonal ${dx}/${dy} follows the finger, coasts and keeps the page steady`);
  }
  await page.goto(base+'/'+scope);await page.reload();const scene=page.locator(scope+' [aria-roledescription=carousel]');await scene.waitFor();await scene.scrollIntoViewIfNeeded();
  const box=await scene.boundingBox(),x=box.x+box.width*.55,y=box.y+box.height*.5;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-24,y:y-10}]});
  const scroll=await page.evaluate(()=>scrollY);
  for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-24-i*16,y:y-10-i*30}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<5);
  pass(`${scope}: a sideways gesture stays locked when the finger curves vertically`);
  await page.goto(base+'/'+scope);await page.reload();await scene.waitFor();await scene.scrollIntoViewIfNeeded();const before=await phase(page,scope),startScroll=await page.evaluate(()=>scrollY),r=await scene.boundingBox();
  const vx=r.x+r.width*.5,vy=r.y+r.height*.5;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:vx,y:vy}]});
  for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:vx+i*2,y:vy-i*30}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
  assert.ok(await page.evaluate(()=>scrollY)>startScroll+30,'Vertical page scrolling must remain native');assert.ok(Math.abs(difference(before.value,(await phase(page,scope)).value,before.count))<.05);
  pass(`${scope}: mostly vertical touch scrolls the page without selecting a barber`);
 }
 assert.deepEqual(errors,[]);await ctx.close();
 const desktop=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'});await fixture(desktop);const p=await desktop.newPage();await p.goto(base+'/#csapat');const region=p.locator('#csapat [aria-roledescription=carousel]');await region.scrollIntoViewIfNeeded();const r=await region.boundingBox();await p.mouse.move(r.x+r.width*.5,r.y+r.height*.4);const old=await phase(p,'#csapat'),scroll=await p.evaluate(()=>scrollY);
 await p.mouse.wheel(120,100);await p.mouse.wheel(25,130);await p.waitForTimeout(180);assert.ok(Math.abs(difference(old.value,(await phase(p,'#csapat')).value,old.count))>.5);assert.ok(Math.abs(await p.evaluate(()=>scrollY)-scroll)<5);pass('desktop diagonal wheel gesture keeps one horizontal axis across the burst');
 await p.waitForTimeout(300);const at=await p.evaluate(()=>scrollY);await p.mouse.wheel(5,150);await p.waitForTimeout(200);assert.ok(await p.evaluate(()=>scrollY)>at+30);pass('a new vertical wheel gesture scrolls the page normally');await desktop.close();
 console.log(`${passed} diagonal gesture checks passed`);
}finally{await browser.close()}
