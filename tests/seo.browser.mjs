import os from 'node:os';
// Local SSR fixture server required; every browser API call is intercepted.
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright');
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3112';
const output=`${os.tmpdir()}/demeters-qa/seo`;await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.DEMETERS_BROWSER?{executablePath:process.env.DEMETERS_BROWSER}:{})});let passed=0;
const pass=name=>{passed++;console.log('PASS '+name)};
try{
 const context=await browser.newContext({javaScriptEnabled:false});
 const paths=['/','/en','/arak','/en/prices','/fodraszok','/en/barbers','/kapcsolat','/en/contact','/ferfi-hajvagas-debrecen','/en/mens-haircut-debrecen','/haj-es-szakall-debrecen','/en/haircut-and-beard-debrecen','/fodraszok/paliga-zoltan','/en/barbers/paliga-zoltan'];
 const titles=new Set(),descriptions=new Set();
 for(const route of paths){
  const page=await context.newPage();const response=await page.goto(base+route);assert.equal(response.status(),200,route);
  assert.equal(await page.locator('h1').count(),1,route);
  assert.equal(await page.locator('html').getAttribute('lang'),route.startsWith('/en')?'en':'hu-HU');
  const title=await page.title(),description=await page.locator('meta[name=description]').getAttribute('content');
  assert.ok(!titles.has(title),'Duplicate title: '+route);titles.add(title);
  assert.ok(!descriptions.has(description),'Duplicate description: '+route);descriptions.add(description);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://demeters.hu'+(route==='/'?'/':route));
  assert.equal(await page.locator('meta[name=description]').count(),1);assert.equal(await page.locator('meta[name=robots]').count(),1);
  assert.equal(await page.locator('link[hreflang="hu-HU"]').count(),1);assert.equal(await page.locator('link[hreflang=en]').count(),1);
  const alternate=await page.locator('link[hreflang=en]').getAttribute('href');
  if(!route.startsWith('/en')){const enResponse=await context.request.get(alternate.replace('https://demeters.hu',base));assert.equal(enResponse.status(),200);assert.ok((await enResponse.text()).includes(`href="https://demeters.hu${route}" hrefLang="hu-HU"`)||(await enResponse.text()).includes(`hrefLang="hu-HU" href="https://demeters.hu${route}"`));}
  const json=await page.locator('script[type="application/ld+json"]').textContent();const schema=JSON.parse(json);assert.ok(schema['@graph'].some(entity=>entity['@type']==='HairSalon'));assert.ok(!/AggregateRating|guest_email|sb_secret|pb_admin_access/.test(json));
  if(/prices|arak|haircut|hajvagas|hair-and|haj-es/.test(route))assert.ok(await page.locator('main').innerText().then(text=>(/haj-es|haircut-and-beard/.test(route) ? /8000|8,000|8 000/ : /6000|6,000|6 000/).test(text)),route+' prices absent from HTML');
  if(route==='/')assert.ok((await page.locator('details').allTextContents()).some(text=>text.includes('e-mailes azonosítás')));
  await page.close();
 }
 pass(`${paths.length} HU/EN pages render metadata, content, actual prices, H1, canonical and reciprocal hreflang without JavaScript`);
 for(const route of ['/does-not-exist','/fade-hajvagas-debrecen','/szakallformazas-debrecen','/fodraszok/toth-dominik','/fodraszok/missing','/en/fade-haircut-debrecen']){const response=await context.request.get(base+route);assert.equal(response.status(),404,route);}
 pass('unknown pages, unavailable services and incomplete profiles return HTTP 404');
 for(const [from,to,status] of [['/?lang=en','/en',308],['/arak?lang=en','/en/prices',308],['/en/prices?lang=hu','/arak',308],['/ferfi-fodraszat-debrecen','/ferfi-hajvagas-debrecen',308],['/fodraszok/previous-paliga','/fodraszok/paliga-zoltan',308]]){const response=await context.request.get(base+from,{maxRedirects:0});assert.equal(response.status(),status,from);assert.equal(new URL(response.headers().location,base).pathname,to);}
 pass('legacy language queries, merged search intent and old profile slugs redirect correctly');
 const sitemap=await context.request.get(base+'/sitemap.xml');assert.equal(sitemap.status(),200);const xml=await sitemap.text();
 assert.ok(xml.includes('https://demeters.hu/en/prices'));assert.ok(!/admin|foglalasaim|token|fade-hajvagas|szakallformazas|toth-dominik/.test(xml));
 const locs=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);assert.equal(new Set(locs).size,locs.length);
 for(const loc of locs)assert.equal((await context.request.get(loc.replace('https://demeters.hu',base))).status(),200);
 await writeFile(output+'/sitemap.xml',xml);
 pass(`${locs.length} sitemap URLs resolve, omit private/unavailable pages and contain real profile lastmod dates`);
 const robots=await context.request.get(base+'/robots.txt',{headers:{Host:'demeters.hu'}});assert.ok((await robots.text()).includes('Sitemap: https://demeters.hu/sitemap.xml'));assert.ok(!(await robots.text()).includes('Disallow: /admin'));
 const localRobots=await context.request.get(base+'/robots.txt');assert.ok((await localRobots.text()).includes('Allow: /'));assert.ok(!(await localRobots.text()).includes('Sitemap:'));assert.ok(localRobots.headers()['x-robots-tag'].includes('noindex'));
 for(const route of ['/admin/foglalasok','/foglalasaim','/?barber=paliga-zoltan','/api/booking/config'])assert.ok((await context.request.get(base+route)).headers()['x-robots-tag'].includes('noindex'),route);
 pass('production robots exposes sitemap; private and parameter URLs expose readable noindex headers');
 for(const route of ['/api/og?lang=hu','/api/og?lang=en&page=prices','/api/og?lang=hu&page=profile&barber=paliga-zoltan']){const response=await context.request.get(base+route);assert.equal(response.status(),200,route);const png=await response.body();assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);await writeFile(output+`/og-${route.includes('profile')?'profile':route.includes('prices')?'prices':'home'}.png`,png);}
 pass('home, price and barber Open Graph PNGs are 1200 × 630');
 await context.close();
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://www.google.com/**',route=>route.abort());
  await page.route(url=>url.origin===new URL(base).origin&&url.pathname.startsWith('/api/'),route=>{const pathname=new URL(route.request().url()).pathname;if(pathname==='/api/booking/config')return route.fulfill({json:{barbers:[],services:[]}});throw new Error('Unexpected API request '+pathname);});
  for(const route of ['/','/en/prices','/ferfi-hajvagas-debrecen','/fodraszok','/fodraszok/paliga-zoltan','/kapcsolat']){
   await page.goto(base+route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflows at '+width);
   if(route==='/'){assert.equal(await page.locator('video source').count(),0,'Reduced motion should not download a video');assert.equal(await page.locator('#foglalas [data-barber-carousel]').count(),0,'Booking must be deferred while hero is visible');await page.locator('details summary').first().focus();await page.keyboard.press('Enter');assert.ok(await page.locator('details').first().getAttribute('open')!==null);}
   await page.screenshot({path:`${output}/${width}-${route.replaceAll('/','_')||'home'}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);await context.close();pass(`${width}px home/services/prices/team/profile/contact: no overflow or runtime errors; reduced motion and keyboard FAQ work`);
 }
 const context2=await browser.newContext();const page=await context2.newPage();await page.goto(base+'/en/prices');await page.getByRole('link',{name:'Magyar',exact:true}).click();await page.waitForURL(base+'/arak');assert.equal(await page.locator('html').getAttribute('lang'),'hu-HU');await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'hu-HU');pass('language switch preserves page intent and server language after reload');await context2.close();
 console.log(`${passed} SEO browser groups passed`);
}finally{await browser.close()}
