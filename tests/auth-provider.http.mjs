import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
const port=3118,base=`http://127.0.0.1:${port}`,secret='fixture-auth-provider-signing-secret-more-than-32-characters';
const env={...process.env,NODE_OPTIONS:'--require=./tests/fixtures/auth-fetch.cjs',DEMETERS_BUILD_DIR:process.env.DEMETERS_BUILD_DIR||'.next-security',SUPABASE_URL:'https://auth-fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SESSION_SIGNING_SECRET:secret,TURNSTILE_SECRET_KEY:'fixture-turnstile',TURNSTILE_HOSTNAMES:'127.0.0.1'};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',String(port)],{env,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',c=>{logs+=c});
const owner='11111111-1111-4111-8111-111111111111',factor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function cookie(aal='aal1',fresh=false){
 const token='fixture.'+Buffer.from(JSON.stringify({sub:owner,session_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',aal,amr:aal==='aal2'?[{method:'totp',timestamp:Math.floor(Date.now()/1000)-(fresh?0:1000)}]:[]})).toString('base64url')+'.signature';
 const payload=`${owner}.${Date.now()+86400000}.p`,signature=createHmac('sha256',secret).update('presztizs-admin-session:v1:'+payload).digest('hex');
 return `pb_admin_access=${token}; pb_admin_refresh=fixture-refresh; pb_admin_until=${payload}.${signature}; pb_admin_trusted_device=${'X'.repeat(43)}`;
}
const post=(path,body,cookies)=>fetch(base+path,{method:'POST',headers:{Origin:base.replace('http:','https:'),'Content-Type':'application/json',...(cookies?{Cookie:cookies}:{})},body:JSON.stringify(body)});
try{
 let ready=false;for(let n=0;n<60;n++){try{const r=await fetch(base+'/api/admin/auth/session');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'fixture server did not start: '+logs);
 const known=await post('/api/admin/auth/send-code',{email:'owner@test.invalid',botToken:'valid-known'});
 const unknown=await post('/api/admin/auth/send-code',{email:'unknown@test.invalid',botToken:'valid-unknown'});
 assert.equal(known.status,200);assert.equal(unknown.status,200);assert.deepEqual(await known.json(),await unknown.json());
 console.log('PASS admin OTP enumeration: identical status/body for active and unknown email; dispatch queued');
 const bot=await post('/api/admin/auth/send-code',{email:'owner@test.invalid',botToken:'invalid'});assert.equal(bot.status,400);
 console.log('PASS server-side bot validation rejects a forged token');
 const noMfa=await post('/api/admin/staff-accounts',{email:'barber@test.invalid'},cookie());assert.equal(noMfa.status,403);assert.equal((await noMfa.json()).code,'mfa_required');
 const stale=await post('/api/admin/staff-accounts',{email:'barber@test.invalid'},cookie('aal2'));assert.equal(stale.status,403);assert.equal((await stale.json()).code,'reauth_required');
 console.log('PASS owner account mutations reject AAL1 and stale AAL2 even with a valid trusted-device cookie');
 const status=await fetch(base+'/api/admin/auth/session',{headers:{Cookie:cookie()}});assert.equal((await status.json()).mfaRequired,true);
 const verify=await post('/api/admin/auth/mfa',{operation:'verify',factorId:factor,code:'123456'},cookie());assert.equal(verify.status,200);assert.match(verify.headers.get('set-cookie'),/pb_admin_access/);
 const upgraded=await fetch(base+'/api/admin/auth/session',{headers:{Cookie:cookie('aal2',true)}});assert.equal((await upgraded.json()).mfaRequired,false);
 console.log('PASS MFA provider challenge upgrades HttpOnly cookies and unlocks the admin session');
 const removeLast=await post('/api/admin/auth/mfa',{operation:'unenroll',factorId:factor},cookie('aal2',true));assert.equal(removeLast.status,409);
 console.log('PASS MFA recovery protection refuses removal of the last verified factor');
 console.log('5 provider-boundary HTTP groups passed (simulated Supabase and Turnstile; no live email)');
}finally{server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,2000)});}
