import {createHmac,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {bookingDb,BookingDbError} from './bookingDb.js';
import {requestContext,httpRequest} from './http.js';
const normalize=value=>typeof value==='string'?value.trim().toLowerCase().slice(0,254):'';
export function clientIp(req) {
  // Vercel overwrites x-vercel-forwarded-for. Never trust client x-forwarded-for.
  const raw=process.env.VERCEL==='1'?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
  if(typeof raw!=='string'||!isIP(raw.trim()))throw new BookingDbError(503,'proxy_configuration','A kérésforrás nem ellenőrizhető.');
  return raw.trim();
}
export function rateKey(...parts) {
  const secret=process.env.RATE_LIMIT_SECRET||process.env.SESSION_SIGNING_SECRET;
  if(!secret||secret.length<32)throw new BookingDbError(503,'rate_configuration');
  return createHmac('sha256',secret).update(parts.join('\0')).digest('hex');
}
export async function consumeRate(req,res,{scope,identity,limit,seconds=60}) {
  const configured=Number(process.env[`RATE_${scope.replace(/[^a-z0-9]/gi,'_').toUpperCase()}_LIMIT`]);
  const result=await bookingDb('rpc/booking_rate_limit',{method:'POST',body:{p_key:rateKey(scope,identity),p_limit:Number.isInteger(configured)&&configured>0?configured:limit,p_seconds:seconds}});
  if(!result?.allowed){res.setHeader('Retry-After',String(result?.retry_after||seconds));res.status(429).json({error:'Túl sok kérés. Próbáld újra később. / Too many requests. Please try again later.',code:'rate_limited'});return null;}
  return result;
}
export async function botCheck(req,action) {
  if(process.env.NODE_ENV!=='production'&&!process.env.TURNSTILE_SECRET_KEY)return;
  if(!process.env.TURNSTILE_SECRET_KEY||!process.env.TURNSTILE_HOSTNAMES)throw new BookingDbError(503,'bot_configuration','Az ellenőrzés átmenetileg nem elérhető. / Verification is unavailable.');
  const token=req.body?.botToken;
  if(typeof token!=='string'||token.length>2048)throw new BookingDbError(400,'bot_required','Végezd el a biztonsági ellenőrzést. / Complete the security check.');
  const {data}=await httpRequest('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:process.env.TURNSTILE_SECRET_KEY,response:token,remoteip:clientIp(req),idempotency_key:randomUUID()})},{service:'turnstile',timeoutMs:5000,attempts:1,consume:r=>r.json()});
  if(!data.success||data.action!==action||!process.env.TURNSTILE_HOSTNAMES.split(',').map(x=>x.trim()).includes(data.hostname))throw new BookingDbError(400,'bot_failed','A biztonsági ellenőrzés lejárt. / Security check expired.');
  // Siteverify can briefly accept token replays; enforce single use atomically here.
  const used=await bookingDb('rpc/booking_rate_limit',{method:'POST',body:{p_key:rateKey('turnstile-token',token),p_limit:1,p_seconds:600}});
  if(!used.allowed)throw new BookingDbError(400,'bot_reused','Ismételd meg az ellenőrzést. / Repeat verification.');
}
export function secureHandler(handler,{path}={}) {
 return async function secured(req,res) {
  const start=Date.now(),id=randomUUID();res.setHeader('X-Request-ID',id);
  return requestContext.run({id,deadline:start+25000,notify:req.body?.notify===true},async()=>{
   let restoreJson,pendingJson,backoffKey;
   try {
    const route=path||req.url?.split('?')[0]||'';
    const auth=/\/(send-code|verify-code|password|mfa)$/.test(route);
    const publicRead=/\/booking\/(availability|earliest|config)$|\/og$/.test(route);
    // Existing method/CSRF/configuration checks happen before consuming DB capacity.
    if((auth&&req.method==='POST')||(publicRead&&['GET','HEAD'].includes(req.method))) {
      if(!process.env.SUPABASE_SECRET_KEY)return handler(req,res);
      if(auth){
        let origin;try{origin=new URL(req.headers.origin);}catch{return res.status(403).json({error:'Érvénytelen kérésforrás.'});}
        if(origin.host!==req.headers.host||!['https:',...(process.env.NODE_ENV!=='production'?['http:']:[])].includes(origin.protocol))return res.status(403).json({error:'Érvénytelen kérésforrás.'});
      }
      const ip=clientIp(req);
      const kind=route.split('/').at(-1);
      const rate=await consumeRate(req,res,{scope:`${kind}-ip`,identity:ip,limit:publicRead?120:kind==='send-code'?8:25,seconds:publicRead?60:600});if(!rate)return;
      const email=normalize(req.body?.email||req.body?.loginName);
      // Pair-based checks delay only this source; sending has a separate short
      // email quota to protect the recipient, without locking sign-in/verification.
      if(auth&&email){
        const pair=await consumeRate(req,res,{scope:`${kind}-pair`,identity:`${ip}:${email}`,limit:kind==='send-code'?3:10,seconds:600});if(!pair)return;
        if(['verify-code','password'].includes(kind)){
          backoffKey=rateKey('login-failure',route,ip,email);
          const delay=await bookingDb('rpc/booking_login_backoff',{method:'POST',body:{p_key:backoffKey,p_failure:false}});
          if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));
        }
        if(kind==='send-code'&&!(await consumeRate(req,res,{scope:'otp-email',identity:email,limit:5,seconds:600})))return;
      }
      if(kind==='send-code'||kind==='password')await botCheck(req,kind);
    }
    if(backoffKey){restoreJson=res.json;res.json=function(data){pendingJson=data;return this;};}
    const result=await handler(req,res);
    if(restoreJson){
      res.json=restoreJson;
      if(res.statusCode===401)await bookingDb('rpc/booking_login_backoff',{method:'POST',body:{p_key:backoffKey,p_failure:true}});
      if(pendingJson!==undefined){if(res.statusCode===429&&!res.getHeader('Retry-After'))res.setHeader('Retry-After','60');return res.json(pendingJson);}
    }
    return result;
   }catch(error){
     if(restoreJson)res.json=restoreJson;
     console.error(JSON.stringify({event:'request_failed',requestId:id,code:error.code||'upstream',status:error.status||503}));
     if(!res.headersSent)return res.status([400,403,429].includes(error.status)?error.status:503).json({error:error instanceof BookingDbError&&error.status===400?error.message:'Átmeneti kapcsolódási hiba. / Temporary connection problem.',code:error.code||'unavailable',requestId:id});
   }finally{
     if(res.statusCode>=400)console.warn(JSON.stringify({event:'http_error',requestId:id,status:res.statusCode,path:path||req.url?.split('?')[0],durationMs:Date.now()-start}));
   }
  });
 };
}
export function verifiedClaims(token) {
 try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{return {};}
}
export function freshMfa(claims,seconds=300) {
 return claims?.aal==='aal2'&&claims.amr?.some(m=>m.method==='totp'&&Number(m.timestamp)*1000>Date.now()-seconds*1000&&Number(m.timestamp)*1000<=Date.now()+30000);
}
export async function securitySettings(){return bookingDb('rpc/booking_security_settings',{method:'POST',body:{}});}
