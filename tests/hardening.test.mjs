import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createRequire} from 'node:module';
import {httpRequest,requestContext,UpstreamError} from '../lib/server/http.js';
import {readLimitedImage,validateImage,downloadPortrait} from '../lib/server/ogImage.js';
import {clientIp,rateKey,freshMfa,secureHandler} from '../lib/server/security.js';
import {revisionFilter} from '../lib/server/revision.js';
const require=createRequire(import.meta.url);
const originalFetch=globalThis.fetch;
test.afterEach(()=>{globalThis.fetch=originalFetch;delete process.env.VERCEL;delete process.env.HTTP_AUTH_TIMEOUT_MS});
test('HTTP body consumption shares the header timeout',async()=>{
 globalThis.fetch=async(url,{signal})=>({ok:true,status:200,text:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))});
 const keepAlive=setTimeout(()=>{},2000);
 try{await assert.rejects(()=>httpRequest('https://example.invalid',{}, {timeoutMs:30}),e=>e instanceof UpstreamError&&e.code==='timeout')}finally{clearTimeout(keepAlive)}
});
test('non-idempotent POST never retries after a network failure',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('lost response')};
 await assert.rejects(()=>httpRequest('https://example.invalid',{method:'POST',body:'booking'},{attempts:3}));assert.equal(calls,1);
});
test('idempotent request retries temporary failure with a stable request ID',async()=>{
 const headers=[];let n=0;globalThis.fetch=async(url,opts)=>{headers.push(opts.headers);return new Response(n++?'ok':'down',{status:n===1?503:200})};
 const result=await requestContext.run({id:'stable-id',deadline:Date.now()+2000},()=>httpRequest('https://example.invalid'));
 assert.equal(result.data,'ok');assert.equal(headers.length,2);assert.ok(headers.every(h=>h['X-Request-ID']==='stable-id'));
});
test('OG advertised oversize is cancelled before reading a body',async()=>{
 let cancelled=false;const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{headers:{'Content-Length':'9000000'}});
 await assert.rejects(()=>readLimitedImage(response),/image_bytes/);assert.equal(cancelled,true);
});
test('OG dishonest Content-Length cannot bypass actual streaming byte limit',async()=>{
 let cancelled=false;const response=new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(6));},cancel(){cancelled=true}}),{headers:{'Content-Length':'1'}});
 await assert.rejects(()=>readLimitedImage(response,{maxBytes:10}),/image_bytes/);assert.equal(cancelled,true);
});
test('OG accepts a real small raster and rejects excessive dimensions',async()=>{
 const small=await sharp({create:{width:4,height:4,channels:3,background:'black'}}).png().toBuffer();assert.equal(await validateImage(small),small);
 const oversized=await sharp({create:{width:8001,height:1,channels:3,background:'black'}}).png().toBuffer();await assert.rejects(()=>validateImage(oversized),/image_pixels/);
});
test('OG preserves strict origin, HTTPS and public storage restrictions',async()=>{
 process.env.SUPABASE_URL='https://test.supabase.co';let called=false;globalThis.fetch=async()=>{called=true;throw new Error('must not fetch')};
 for(const url of ['http://test.supabase.co/storage/v1/object/public/x','https://attacker.invalid/storage/v1/object/public/x','https://test.supabase.co/auth/v1/user','https://name:pass@test.supabase.co/storage/v1/object/public/x'])await assert.rejects(()=>downloadPortrait(url),/image_origin/);
 assert.equal(called,false);
});
test('rate identity ignores spoofed forwarding headers outside the trusted Vercel proxy',()=>{
 assert.equal(clientIp({headers:{'x-forwarded-for':'1.1.1.1'},socket:{remoteAddress:'127.0.0.1'}}),'127.0.0.1');
 process.env.VERCEL='1';assert.equal(clientIp({headers:{'x-vercel-forwarded-for':'2.2.2.2','x-forwarded-for':'1.1.1.1'}}),'2.2.2.2');
 assert.throws(()=>clientIp({headers:{'x-forwarded-for':'1.1.1.1'}}),e=>e.code==='proxy_configuration');
});
test('rate keys contain only a keyed digest and are scoped to the operation',()=>{
 process.env.RATE_LIMIT_SECRET='test-only-secret-for-hmac-long-enough';const key=rateKey('otp','guest@example.invalid');assert.match(key,/^[a-f0-9]{64}$/);assert.notEqual(key,rateKey('verify','guest@example.invalid'));assert.notEqual(key,rateKey('otp','other@example.invalid'));
});
test('step-up requires recent provider TOTP evidence; a fresh iat alone is insufficient',()=>{
 const now=Math.floor(Date.now()/1000);
 assert.equal(freshMfa({aal:'aal2',iat:now,amr:[{method:'password',timestamp:now}]}),false);
 assert.equal(freshMfa({aal:'aal1',amr:[{method:'totp',timestamp:now}]}),false);
 assert.equal(freshMfa({aal:'aal2',amr:[{method:'totp',timestamp:now-301}]}),false);
 assert.equal(freshMfa({aal:'aal2',amr:[{method:'totp',timestamp:now+1000}]}),false);
 assert.equal(freshMfa({aal:'aal2',amr:[{method:'totp',timestamp:now}]}),true);
});
test('stale or missing record versions are rejected instead of choosing the latest silently',()=>{
 for(const revision of [null,undefined,0,-1,'1',1.5])assert.throws(()=>revisionFilter(revision),e=>e.status===409);
 assert.equal(revisionFilter(3),'eq.3');
});
test('CSP report-only candidate denies inline scripts while supporting Motion styles and Turnstile',()=>{
 const {csp}=require('../csp.config.cjs');assert.match(csp,/object-src 'none'/);assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/base-uri 'self'/);assert.match(csp,/form-action 'self'/);
 const script=csp.split('; ').find(x=>x.startsWith('script-src '));assert.doesNotMatch(script,/unsafe-inline|\*/);assert.match(script,/challenges.cloudflare.com/);
});
test('API boundary refuses cross-site OTP attempts before rate limit/database/bot work',async()=>{
 process.env.SUPABASE_SECRET_KEY='sb_secret_test';let called=false;globalThis.fetch=async()=>{called=true;throw new Error('unexpected')};
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(d){this.data=d;return this}};
 await secureHandler(()=>{throw new Error('handler should not run')},{path:'/api/guest/send-code'})({method:'POST',headers:{host:'localhost',origin:'https://evil.invalid'},body:{email:'guest@example.invalid'}},res);
 assert.equal(res.statusCode,403);assert.equal(called,false);
});
test('HTTP 429 includes an actionable Retry-After and never runs an expensive handler',async()=>{
 process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.SUPABASE_URL='https://test.supabase.co';process.env.RATE_LIMIT_SECRET='a-test-value-longer-than-32-characters';
 globalThis.fetch=async()=>new Response(JSON.stringify({allowed:false,retry_after:42}));
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(d){this.data=d;return this}};
 await secureHandler(()=>{throw new Error('must not execute')},{path:'/api/booking/earliest'})({method:'GET',headers:{},socket:{remoteAddress:'127.0.0.1'}},res);
 assert.equal(res.statusCode,429);assert.equal(res.headers['Retry-After'],'42');assert.equal(res.data.code,'rate_limited');
});
test('API optimistic concurrency rejects one real edit after two readers receive the same revision',async()=>{
 const {editAdminAppointment}=await import('../lib/server/adminCalendar.js');
 const id='55555555-5555-4555-8555-555555555555';
 const record={id,revision:1,staff_id:'qa-one',service_id:'qa-cut',starts_at:'2091-06-01T08:00:00Z',ends_at:'2091-06-01T08:30:00Z',price_huf:5000,status:'confirmed',is_manual:true,guest_name:'Original',guest_email:null};
 let readers=0,release;const bothRead=new Promise(r=>release=r);
 globalThis.fetch=async(raw,options={})=>{
  const url=new URL(raw),table=url.pathname.split('/').at(-1);let value=[];
  if(table==='booking_appointments'){
   if(options.method==='PATCH'){
    if(url.searchParams.get('revision')===`eq.${record.revision}`){Object.assign(record,JSON.parse(options.body),{revision:record.revision+1});value=[record];}
   }else{const snapshot={...record};readers++;if(readers===2)release();await bothRead;value=[snapshot];}
  }
  if(table==='booking_services')value=[{id:'qa-cut',staff_id:'qa-one',name:'Cut',duration_minutes:30,price_huf:5000,active:true}];
  if(table==='booking_staff')value=[{id:'qa-one',name:'Barber',active:true}];
  return new Response(JSON.stringify(value));
 };
 const payload={revision:1,staffId:'qa-one',serviceId:'qa-cut',date:'2091-06-01',time:'10:00',guestName:'First',status:'confirmed'};
 const results=await Promise.allSettled([editAdminAppointment(id,payload,{role:'owner'}),editAdminAppointment(id,{...payload,guestName:'Second'},{role:'owner'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);assert.equal(record.revision,2);
});
test('email outage leaves a durable outbox failure instead of pretending mail was delivered',async()=>{
 const {drainOutbox}=await import('../lib/server/outbox.js');
 process.env.RESEND_API_KEY='test-only';process.env.RESEND_FROM='test@example.invalid';process.env.SITE_URL='https://demeters.hu';
 let finished,requests=0;globalThis.fetch=async(raw,options={})=>{
  const url=new URL(raw);
  if(url.hostname==='api.resend.com'){requests++;assert.match(options.headers['Idempotency-Key'],/^demeters\//);return new Response('{}',{status:503});}
  if(url.pathname.endsWith('/booking_claim_outbox'))return new Response(JSON.stringify([{id:'job-1',kind:'receipt',audience:'guest',lease_token:'lease-1',payload:{staff_email:'staff@example.invalid',booking:{id:'55555555-5555-4555-8555-555555555555',guest_email:'guest@example.invalid',guest_name:'Guest',service_name:'Cut',staff_name:'Barber',starts_at:'2091-01-01T10:00:00Z',price_huf:5000}}}]));
  if(url.pathname.endsWith('/booking_finish_outbox')){finished=JSON.parse(options.body);return new Response('true');}
  throw new Error('Unexpected outbox call');
 };
 const result=await drainOutbox();assert.equal(result.failed,1);assert.equal(result.sent,0);assert.equal(finished.p_success,false);assert.equal(requests,2);
});
