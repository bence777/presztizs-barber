import test from 'node:test';
import assert from 'node:assert/strict';
import { alternatePath, bookingHref, identifyPath, SITE } from '../data/site.mjs';
import { availableServiceKeys, profileAvailable, priceRange, publicPaths, serviceName, serviceCategory } from '../lib/seo/catalog.mjs';
import { buildSchema, serializeJsonLd } from '../lib/seo/schema.mjs';
import { pageMetadata } from '../data/seoContent.mjs';
import { validatePublicProfile, publicImageUrl } from '../lib/server/publicProfileValidation.js';
import { saveSettings } from '../lib/server/staffSettings.js';
const barber = { id:'paliga-zoltan', slug:'paliga-zoltan', name:'Paliga Zoltán', bio:'Saját, nyilvános bemutatkozás, amely elegendő tartalmat ad az oldalhoz.', bioEn:'An original introduction with enough public information for this barber’s page.', specializations:[], portfolio:[], socialLinks:{} };
const catalog = { barbers:[barber], services:[{ id:'cut-one', staffId:barber.id, name:'Hajvágás', duration:30, price:6000 },{ id:'combo-one', staffId:barber.id, name:'Haj és szakáll', duration:60, price:8000 },{ id:'color-one', staffId:barber.id, name:'Hajfestés', duration:90, price:12000 }] };

test('translated paths, old query compatibility targets and service booking links preserve intent', () => {
  assert.equal(SITE.origin,'https://demeters.hu');
  assert.equal(alternatePath('/arak?barber=one','en'),'/en/prices');
  assert.equal(alternatePath('/en/barbers/paliga-zoltan','hu'),'/fodraszok/paliga-zoltan');
  assert.equal(identifyPath('/unknown'),null);
  const url = new URL(bookingHref('en',barber,catalog.services[0]),SITE.origin);
  assert.equal(url.pathname,'/en'); assert.equal(url.hash,'#foglalas');
  assert.equal(url.searchParams.get('service'),'cut-one'); assert.equal(url.searchParams.get('barber'),barber.id);
});
test('only actual service categories create pages; combined services do not imply standalone beard appointments', () => {
  assert.deepEqual(availableServiceKeys(catalog),['haircut','combo']);
  assert.equal(serviceCategory({name:'Szakállvágás'}),'beard');
  assert.equal(serviceCategory({name:'Szakállfestés'}),null);
  assert.equal(serviceCategory({name:'Hajfestés'}),null);
  assert.equal(priceRange([...catalog.services.slice(0,1),{price:7000}]),'6000–7000 Ft');
  assert.equal(serviceName(catalog.services[0],'en'),'Haircut');
  assert.equal(serviceName({...catalog.services[0],nameEn:'My custom haircut'},'en'),'My custom haircut');
  const paths=publicPaths(catalog);
  assert.ok(!paths.some(page=>['beard','fade'].includes(page.key)));
  assert.equal(paths.filter(page=>page.key==='profile').length,2);
});
test('profiles with missing content or services are excluded, and untranslated profiles have no English URL', () => {
  assert.equal(profileAvailable({...barber,bio:''},catalog),false);
  assert.equal(profileAvailable(barber,{...catalog,services:[]}),false);
  assert.equal(profileAvailable({...barber,bioEn:''},catalog,'en'),false);
  assert.ok(!publicPaths({...catalog,barbers:[{...barber,bio:''}]}).some(page=>page.key==='profile'));
});
test('metadata is unique by intent and language; schema prices come from the same actual services', () => {
  const titles=new Set();
  for(const language of ['hu','en'])for(const key of ['home','prices','team','contact','haircut','combo'])titles.add(pageMetadata(key,language).title);
  assert.equal(titles.size,12);
  const schema=buildSchema({path:'/arak',title:'Árak',description:'Aktuális árak',catalog,services:catalog.services,language:'hu',breadcrumbs:[{name:'Főoldal',path:'/'},{name:'Árak',path:'/arak'}]});
  const salon=schema['@graph'].find(entity=>entity['@type']==='HairSalon');
  assert.equal(salon['@id'],'https://demeters.hu/#salon'); assert.ok(!salon.aggregateRating); assert.equal(salon.address.streetAddress,'Csapó utca 13.'); assert.ok(!salon.telephone);
  const offers=schema['@graph'].find(entity=>entity['@type']==='OfferCatalog').itemListElement;
  assert.deepEqual(offers.map(offer=>offer.price),[6000,8000,12000]);
  assert.ok(offers.every(offer=>offer.priceCurrency==='HUF'));
  const breadcrumb=schema['@graph'].find(entity=>entity['@type']==='BreadcrumbList');
  assert.equal(breadcrumb.itemListElement[1].item,'https://demeters.hu/arak');
});
test('JSON-LD serialization cannot break out of its script element', () => {
  const unsafe={name:'</script><script>alert(1)</script>&\u2028'};
  const json=serializeJsonLd(unsafe);
  assert.ok(!json.includes('<'));assert.ok(!json.includes('&'));assert.deepEqual(JSON.parse(json),unsafe);
});
test('public profile validation rejects script URLs, excessive content and unapproved social hosts', () => {
  for(const src of ['javascript:alert(1)','https://localhost/image.png','https://127.0.0.1/image.png','/images/../secret','https://example.com:443@localhost/x'])assert.equal(publicImageUrl(src),false);
  assert.equal(publicImageUrl('/images/demetertamas.webp'),true);
  assert.throws(()=>validatePublicProfile({public_slug:'Bad Slug'}));
  assert.throws(()=>validatePublicProfile({social_links:{instagram:'https://instagram.com.evil.invalid/p'}}));
  assert.throws(()=>validatePublicProfile({bio:'x'.repeat(3001)}));
  const result=validatePublicProfile({bio:' My introduction ',email:'private@example.com',role:'owner',active:false,portfolio:[{src:'/images/demetertamas.webp',alt:'Work',secret:'never returned'}]});
  assert.deepEqual(Object.keys(result).sort(),['bio','portfolio']);assert.ok(!('secret' in result.portfolio[0]));
});
test('another barber cannot edit profile content, slug, portfolio or social links', async () => {
  await assert.rejects(()=>saveSettings({role:'barber',staff_id:'staff-one'}, {staffId:'staff-two',bio:'An unrelated profile',public_slug:'take-over',portfolio:[]}),error=>error.status===403);
});
