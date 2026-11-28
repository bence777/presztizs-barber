import sharp from 'sharp';
import {httpRequest} from './http.js';
export const MAX_IMAGE_BYTES=8_000_000;
export async function readLimitedImage(response,{maxBytes=MAX_IMAGE_BYTES}={}) {
  const advertised=Number(response.headers.get('content-length'));
  if(advertised>maxBytes){await response.body?.cancel();throw new Error('image_bytes');}
  if(!response.ok||!response.body)throw new Error('image_response');
  const reader=response.body.getReader();const chunks=[];let size=0;
  try {
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>maxBytes)throw new Error('image_bytes');chunks.push(Buffer.from(value));}
  }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  return Buffer.concat(chunks,size);
}
export async function validateImage(bytes) {
  if(bytes.length>MAX_IMAGE_BYTES)throw new Error('image_bytes');
  const metadata=await sharp(bytes,{limitInputPixels:16_000_000,animated:false}).metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)||!metadata.width||!metadata.height||metadata.width>8000||metadata.height>8000||metadata.width*metadata.height>16_000_000||(metadata.pages||1)>1)throw new Error('image_pixels');
  return bytes;
}
export async function downloadPortrait(photo) {
  const origin=new URL(process.env.SUPABASE_URL);
  const url=new URL(photo);
  if(url.origin!==origin.origin||url.protocol!=='https:'||url.username||url.password||!url.pathname.startsWith('/storage/v1/object/public/'))throw new Error('image_origin');
  const {data}=await httpRequest(url,{redirect:'error'},{service:'og',timeoutMs:4000,attempts:1,consume:async r=>{
    const mime=r.headers.get('content-type')?.split(';')[0];
    if(!['image/webp','image/jpeg','image/png'].includes(mime)){await r.body?.cancel();throw new Error('image_type');}
    const bytes=await validateImage(await readLimitedImage(r));return `data:${mime};base64,${bytes.toString('base64')}`;
  }});return data;
}
