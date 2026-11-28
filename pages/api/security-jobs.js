import {timingSafeEqual} from 'node:crypto';
import {secureHandler} from '../../lib/server/security';
import {bookingDb} from '../../lib/server/bookingDb';
import {drainOutbox} from '../../lib/server/outbox';
export const config={maxDuration:60};
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).end();
 const expected=`Bearer ${process.env.CRON_SECRET||''}`,provided=req.headers.authorization||'';
 if(!process.env.CRON_SECRET||expected.length!==provided.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return res.status(401).json({error:'Unauthorized'});
 const delivered=await drainOutbox();

 console.info(JSON.stringify({event:'security_jobs',...delivered}));
 return res.json({...delivered});
}
export default secureHandler(handler,{path:'/api/security-jobs'});
