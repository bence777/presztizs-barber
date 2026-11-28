import assert from 'node:assert/strict';
const base=process.env.DEMETERS_PREVIEW_URL||'http://127.0.0.1:3112';
let count=0;
async function probe(path, options, expected) {
 const r=await fetch(base+path,options);assert.equal(r.status,expected,`${path}: ${await r.clone().text()}`);count++;console.log(`PASS ${path}: ${r.status}`);return r;
}
for(const path of ['/api/admin/bookings','/api/admin/options','/api/admin/calendar?from=2026-11-01&to=2026-12-01','/api/admin/settings?staffId=paliga-zoltan','/api/admin/staff-accounts','/api/admin/devices','/api/guest/me','/api/guest/devices','/api/booking/mine']){
 const r=await probe(path,{},401);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('access-control-allow-origin'),null);
}
for(const headers of [{},{Origin:'https://attacker.invalid'},{Origin:'null'}])await probe('/api/booking/create',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'},403);
await probe('/api/booking/create',{method:'POST',headers:{Origin:base.replace('http:','https:'),'Content-Type':'application/json'},body:JSON.stringify({serviceId:'bad',barberId:'bad',date:'2026-11-28',time:'10:00'})},401);
await probe('/api/booking/create',{},405);
await probe('/api/booking/availability?service=x&barber=x&month=9999-12',{},400);
const r=await probe('/',{},200);
for(const h of ['x-content-type-options','x-frame-options','referrer-policy','permissions-policy','cross-origin-opener-policy','strict-transport-security'])assert.ok(r.headers.get(h),h);
assert.ok(r.headers.get('content-security-policy')||r.headers.get('content-security-policy-report-only'));
const html=await r.text();assert.ok(!/sb_secret_[A-Za-z0-9_-]+/.test(html));
console.log(`${count} original HTTP security probes passed`);
await probe('/api/security-jobs',{},401);
await probe('/api/admin/auth/mfa',{},401);
await probe('/api/admin/auth/mfa',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'},403);
console.log(`${count} total HTTP security probes passed`);
