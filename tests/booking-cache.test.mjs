import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilityKey, getCachedAvailability, invalidateCachedAvailability, loadPublicCatalog, loadPublicAvailability } from '../lib/client/bookingCache.mjs';

const initialFetch = globalThis.fetch;
let calls = [];
globalThis.fetch = async (url,options={}) => {
  calls.push({url:String(url),options});
  if (String(url).includes('/config')) return { ok:true, json:async()=>({services:[{id:'hajvagas'}],barbers:[{id:'barber-1'}]}) };
  return { ok:true, json:async()=>({days:{'2026-11-12':[{value:'11:00',available:true}]},hasWorkingHours:true}) };
};

test('Public catalog deduplicates concurrent requests and reuses cache',async()=>{
  const [a,b] = await Promise.all([loadPublicCatalog(),loadPublicCatalog()]);
  assert.deepEqual(a,b);
  await loadPublicCatalog();
  assert.equal(calls.filter(x=>x.url.includes('/config')).length,1);
  assert.equal(calls[0].options.credentials,'omit');
});

test('Availability is keyed per service, barber and month and cached',async()=>{
  const key = availabilityKey('hajvagas','barber-1','2026-11');
  assert.equal(key,'hajvagas|barber-1|2026-11');
  const [a,b] = await Promise.all([loadPublicAvailability('hajvagas','barber-1','2026-11'),loadPublicAvailability('hajvagas','barber-1','2026-11')]);
  assert.deepEqual(a,b);
  assert.deepEqual(getCachedAvailability('hajvagas','barber-1','2026-11'),a);
  assert.equal(calls.filter(x=>x.url.includes('/availability')).length,1);
  invalidateCachedAvailability('hajvagas','barber-1','2026-11');
  assert.equal(getCachedAvailability('hajvagas','barber-1','2026-11'),null);
  await loadPublicAvailability('hajvagas','barber-1','2026-11', {force:true});
  assert.equal(calls.filter(x=>x.url.includes('/availability')).length,2);
  assert.match(calls.at(-1).url,/refresh=/);
  globalThis.fetch = initialFetch;
});
