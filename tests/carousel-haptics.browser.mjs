// Vibration API is mocked: validates timing/integration, not physical motor feel.
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright');
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3114';
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
let passed=0;const pass=text=>{passed++;console.log('PASS '+text)};
async function swipe(page,scope) {
 const scene=page.locator(scope+' [aria-roledescription=carousel]');await scene.scrollIntoViewIfNeeded();
 const box=await scene.boundingBox(),cdp=await page.context().newCDPSession(page);
 const x=box.x+box.width*.75,y=box.y+box.height*.4;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 // Pipeline samples so native input acknowledgement does not slow down the flick.
 const moves=[];
 for(let i=1;i<=5;i++){moves.push(cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*30,y}]}));await page.waitForTimeout(12)}
 await Promise.all(moves);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
async function mock(context,supported=true) {
 await context.addInitScript(support=>{window.__hapticPulses=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:support?(ms=>{window.__hapticPulses.push({ms,time:performance.now()});return true}):undefined})},supported);
 await context.route('**/api/**',route=>{assert.equal(route.request().method(),'GET');if(new URL(route.request().url()).pathname==='/api/booking/config')return route.continue();throw new Error('Unexpected API')});
}
try {
 const context=await browser.newContext({viewport:{width:390,height:950},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});await mock(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#csapat');const team=page.locator('#csapat');
 await team.getByRole('button',{name:'Rezgés kikapcsolása',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__hapticPulses),[]);pass('supported touch device exposes the toggle without vibrating on load');
 await team.getByRole('button',{name:'Rezgés kikapcsolása',exact:true}).click();
 await team.getByRole('button',{name:'Rezgés bekapcsolása',exact:true}).click();
 await swipe(page,'#csapat');await page.waitForTimeout(2200);
 const pulses=(await page.evaluate(()=>window.__hapticPulses)).filter(p=>p.ms>0);
 assert.ok(pulses.some(p=>p.ms===6));assert.equal(pulses.at(-1).ms,10);assert.ok(pulses.length<=10);
 for(let i=1;i<pulses.length;i++)assert.ok(pulses[i].time-pulses[i-1].time>=80);
 pass('flick has spaced 6 ms ticks, a 10 ms landing pulse and no continuous buzzing');
 await team.getByRole('button',{name:'Rezgés kikapcsolása',exact:true}).click();await page.evaluate(()=>{window.__hapticPulses=[]});
 await swipe(page,'#csapat');await page.waitForTimeout(2000);assert.deepEqual(await page.evaluate(()=>window.__hapticPulses),[]);
 await page.locator('#foglalas').scrollIntoViewIfNeeded();await page.locator('#foglalas').getByRole('button',{name:'Rezgés bekapcsolása',exact:true}).waitFor();
 assert.equal(await page.locator('#foglalas').getByRole('button',{name:'Rezgés bekapcsolása'}).getAttribute('aria-pressed'),'false');
 await page.reload();await page.locator('#csapat').getByRole('button',{name:'Rezgés bekapcsolása',exact:true}).waitFor();
 pass('opt-out silences both carousels and persists across reload');
 await page.locator('#csapat').getByRole('button',{name:'Rezgés bekapcsolása',exact:true}).click();await swipe(page,'#csapat');
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.__hapticPulses=[]});
 await page.waitForTimeout(2200);assert.deepEqual(await page.evaluate(()=>window.__hapticPulses),[]);pass('backgrounding cancels feedback and prevents delayed landing vibrations');
 assert.deepEqual(errors,[]);await context.close();
 for(const [support,motion] of [[false,'no-preference'],[true,'reduce']]) {
  const ctx=await browser.newContext({viewport:{width:320,height:900},isMobile:true,hasTouch:true,reducedMotion:motion});await mock(ctx,support);
  const p=await ctx.newPage();await p.goto(base+'/#csapat');await p.locator('#csapat article').first().waitFor();
  await swipe(p,'#csapat');await p.waitForTimeout(2000);assert.equal(await p.locator('#csapat button[class*=hapticsButton]').count(),0);
  assert.deepEqual(await p.evaluate(()=>window.__hapticPulses),[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  pass(support?'reduced-motion preference suppresses haptics':'unsupported browsers retain scrolling with no haptic control or API calls');await ctx.close();
 }
 console.log(`${passed} haptic integration checks passed`);
}finally{await browser.close()}
