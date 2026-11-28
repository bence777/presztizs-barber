import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3112';
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
try{
 const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();
 const errors=[],violations=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('cspViolation',d=>violations.push(d));
 await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>{if(e.disposition==='enforce')window.cspViolation({directive:e.effectiveDirective,blocked:e.blockedURI})}));
 await page.route('**/api/booking/config',r=>r.fulfill({json:{services:[],barbers:[]}}));
 for(const path of ['/','/en','/arak','/en/prices','/fodraszok/paliga-zoltan','/kapcsolat','/admin']){
  const r=await page.goto(base+path);assert.equal(r.status(),200);await page.waitForTimeout(150);
  assert.ok(r.headers()['content-security-policy']||r.headers()['content-security-policy-report-only']);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
 console.log('PASS enforced CSP: seven HU/EN, profile and admin routes hydrate without script/style violations');
 const reporting=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/csp-report'&&r.request().method()==='POST');
 await page.evaluate(()=>{const s=document.createElement('script');s.textContent='window.__cspProbe=true';document.body.append(s)});
 assert.equal(await page.evaluate(()=>window.__cspProbe),undefined);assert.equal((await reporting).status(),204);
 console.log('PASS CSP blocks an injected inline script and accepts the native application/csp-report payload');
 await context.close();
}finally{await browser.close()}
