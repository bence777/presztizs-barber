import test from 'node:test';
import assert from 'node:assert/strict';
import { setGuestCookies, getGuest, getProfile, jsonOnly, isConfigured } from '../lib/server/guestAuth.js';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
process.env.SESSION_SIGNING_SECRET = 'test-only-sufficiently-long-hmac-key-0123456789';
process.env.NODE_ENV = 'production';
const userId = 'bf763a63-087b-487b-85bc-fbf63be22323';

function response() {
  const headers = new Map();
  return {
    headers,
    getHeader(key) { return headers.get(key); },
    setHeader(key,value) { headers.set(key,value); },
    status(n) { this.statusCode=n; return this; },
    json(body) { this.body=body; return this; },
  };
}
function cookieJar(setCookies) {
  return Object.fromEntries(setCookies.map((s) => {
    const [name, ...value] = s.split(';')[0].split('=');
    return [name, decodeURIComponent(value.join('='))];
  }));
}
function mockOk(data, status=200) {
  return { ok:status>=200&&status<300, status, text:async()=>JSON.stringify(data) };
}

test('configured with server-only keys', () => {
  assert.equal(isConfigured(),true);
});

test('cookie session persists, is HttpOnly and expires at fixed 60 days', async () => {
  const res = response();
  setGuestCookies(res, { access_token:'short-jwt', refresh_token:'server-refresh-token' }, userId, { remember:true });
  const setCookies = res.getHeader('Set-Cookie');
  assert.equal(setCookies.length,3);
  assert.ok(setCookies.every(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Lax')));
  assert.ok(setCookies.every(c=>c.includes('Max-Age=')));
  const cookies = cookieJar(setCookies);
  const beforeFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.toString().endsWith('/auth/v1/user')) return mockOk({ id:userId,email:'guest@example.com' });
    throw new Error('Unexpected API call');
  };
  try {
    const live = await getGuest({cookies}, response());
    assert.equal(live.user.id,userId);
    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + (61 * 24 * 60 * 60 * 1000);
    try {
      const expiredRes = response();
      const expired = await getGuest({cookies},expiredRes);
      assert.equal(expired,null);
      assert.equal(expiredRes.getHeader('Set-Cookie').length,3);
    } finally { Date.now = originalDateNow; }
  } finally { globalThis.fetch = beforeFetch; }
});

test('refreshes an expired access token but preserves absolute deadline',async()=>{
  const res=response();
  setGuestCookies(res,{access_token:'old',refresh_token:'old-r'},userId,{remember:true});
  const cookies=cookieJar(res.getHeader('Set-Cookie'));
  const oldDeadline=cookies.pb_device_until;
  const beforeFetch=globalThis.fetch;
  const paths=[];
  globalThis.fetch=async (url,opts)=>{
    paths.push(url.toString());
    if(url.toString().endsWith('/auth/v1/user') && opts.headers.Authorization==='Bearer old')return mockOk({message:'expired'},401);
    if(url.toString().endsWith('/auth/v1/token?grant_type=refresh_token')) return mockOk({access_token:'fresh',refresh_token:'fresh-r'});
    if(url.toString().endsWith('/auth/v1/user') && opts.headers.Authorization==='Bearer fresh')return mockOk({id:userId,email:'guest@example.com'});
    throw new Error(`unexpected ${url}`);
  };
  try {
    const newRes=response();
    const guest=await getGuest({cookies},newRes);
    assert.equal(guest.token,'fresh');
    assert.equal(cookieJar(newRes.getHeader('Set-Cookie')).pb_device_until,oldDeadline);
    assert.equal(paths.length,3);
  } finally {globalThis.fetch=beforeFetch;}
});

test('profile read is authenticated with the users own JWT',async()=>{
  const beforeFetch=globalThis.fetch;
  globalThis.fetch=async (url,opts)=>{
    assert.equal(opts.headers.Authorization,'Bearer guest-jwt');
    assert.equal(opts.headers.apikey,'sb_publishable_test');
    assert.match(url.toString(),/guest_profiles/);
    return mockOk([{full_name:'Béla Teszt',phone:'+36 301234567'}]);
  };
  try {
    const result=await getProfile({user:{id:userId},token:'guest-jwt'});
    assert.equal(result.full_name,'Béla Teszt');
  } finally {globalThis.fetch=beforeFetch;}
});

test('POST endpoints reject cross-origin requests',()=>{
  const res=response();
  const allowed=jsonOnly({method:'POST',headers:{origin:'https://attacker.example',host:'barber.example'}},res,'POST');
  assert.equal(allowed,false);
  assert.equal(res.statusCode,403);
});
