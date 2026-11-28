import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3119';
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});
try{
 const nojs=await browser.newContext({javaScriptEnabled:false});
 for(const [path,lang,title,role] of [['/adatvedelem','hu-HU','Adatvédelmi tájékoztató','önálló adatkezelő'],['/en/privacy','en','Privacy notice','independent controller']]){
  const page=await nojs.newPage();const response=await page.goto(base+path);assert.equal(response.status(),200);
  assert.equal(await page.locator('html').getAttribute('lang'),lang);assert.equal(await page.locator('h1').innerText(),title);
  assert.match(await page.locator('article').innerText(),new RegExp(role));assert.equal(await page.locator('article #adatkezelo tbody tr').count(),7);
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://demeters.hu'+path);
  assert.equal(await page.locator('article section').count(),16);
  assert.ok(await page.locator('a[href="https://www.cloudflare.com/turnstile-privacy-policy/"]').count());
  await page.close();
 }
 await nojs.close();console.log('PASS HU/EN privacy SSR: full content without JavaScript, seven independent-controller entries, draft/noindex and canonical');
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/adatvedelem');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('link',{name:'English',exact:true}).click();await page.waitForURL(base+'/en/privacy');await page.getByRole('heading',{name:'Privacy notice',exact:true}).waitFor();assert.equal(await page.locator('h1').innerText(),'Privacy notice');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('link',{name:'Magyar',exact:true}).click();await page.waitForURL(base+'/adatvedelem');await page.getByRole('heading',{name:'Adatvédelmi tájékoztató',exact:true}).waitFor();
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('article section').count(),16);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS 320/390/1440px privacy layout, reciprocal language switch, printable content and no JS errors');
 const context=await browser.newContext();const page=await context.newPage();
 await page.route('**/api/guest/session',r=>r.fulfill({json:{remembered:false}}));
 await page.goto(base+'/foglalasaim?lang=en');await page.getByRole('button',{name:'SEND VERIFICATION CODE',exact:true}).waitFor();assert.equal(await page.locator('a[href="/en/privacy"]').count(),1);
 await page.goto(base+'/');assert.ok(await page.locator('footer a[href="/adatvedelem"]').count());
 assert.ok(!(await (await context.request.get(base+'/sitemap.xml')).text()).includes('/adatvedelem'));
 await context.close();console.log('PASS notice accessible before guest data submission and in footer; draft omitted from sitemap');
}finally{await browser.close()}
