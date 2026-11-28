import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
export const requestContext = new AsyncLocalStorage();
export class UpstreamError extends Error {
  constructor(service, code, status=503) { super(`${service}:${code}`); this.code=code; this.status=status; this.service=service; }
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// The timeout covers headers AND consuming the body. Retrying writes requires an
// explicit idempotency key; a timed out write may already have committed.
export async function httpRequest(url, options={}, {service='upstream',timeoutMs,attempts=2,consume=r=>r.text()}={}) {
  const context=requestContext.getStore();
  const id=context?.id||randomUUID();
  const configured=Number(process.env[`HTTP_${service.toUpperCase()}_TIMEOUT_MS`]);
  const end=Math.min(context?.deadline||Infinity,Date.now()+(timeoutMs||configured||8000));
  const method=(options.method||'GET').toUpperCase();
  const headers=new Headers(options.headers);
  headers.set('X-Request-ID',id);
  const retryable=['GET','HEAD'].includes(method)||headers.has('Idempotency-Key');
  for(let attempt=0;;attempt++) {
    const remaining=end-Date.now();
    if(remaining<=0)throw new UpstreamError(service,'timeout');
    const signal=AbortSignal.any([AbortSignal.timeout(Math.max(1,remaining)),...(options.signal?[options.signal]:[])]);
    try {
      const response=await fetch(url,{...options,headers:{...(options.headers instanceof Headers?Object.fromEntries(options.headers):options.headers),'X-Request-ID':id},signal});
      if(retryable&&attempt+1<attempts&&[429,502,503,504].includes(response.status)) {
        await response.body?.cancel();
        const delay=Math.min(1000,150*2**attempt+Math.random()*100);
        if(Date.now()+delay>=end)throw new UpstreamError(service,'timeout');
        await pause(delay);continue;
      }
      const data=await consume(response);
      return {response,data};
    } catch(error) {
      if(error instanceof UpstreamError)throw error;
      if(signal.aborted)throw new UpstreamError(service,'timeout');
      if(!retryable||attempt+1>=attempts)throw new UpstreamError(service,'network');
      await pause(Math.min(500,100*2**attempt+Math.random()*100));
    }
  }
}
export async function httpFetch(url,options={},config={}) {
  // Materialize response inside the deadline; callers may parse the bounded body.
  const target=new URL(url);
  const service=target.hostname==='api.resend.com'?'resend':target.pathname.startsWith('/auth/')?'auth':'database';
  const {response,data}=await httpRequest(url,options,{service,...config,consume:r=>r.text()});
  return {ok:response.ok,status:response.status,headers:response.headers,text:async()=>data,json:async()=>JSON.parse(data)};
}
