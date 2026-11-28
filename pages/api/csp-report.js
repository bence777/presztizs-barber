import {secureHandler,consumeRate,clientIp} from '../../lib/server/security';
export const config={api:{bodyParser:{sizeLimit:'8kb'}}};
async function handler(req,res){
 if(req.method!=='POST')return res.status(405).end();
 res.setHeader('Cache-Control','no-store');
 if(!(await consumeRate(req,res,{scope:'csp-report-ip',identity:clientIp(req),limit:30,seconds:60})))return;
 let parsed=req.body;
 if(typeof parsed==='string'){try{parsed=JSON.parse(parsed)}catch{return res.status(400).end();}}
 const report=parsed?.['csp-report'];
 if(!report||typeof report['effective-directive']!=='string')return res.status(400).end();
 // Never log full document/blocked URLs: they can contain guest IDs or tokens.
 console.warn(JSON.stringify({event:'csp_violation',directive:report['effective-directive'].replace(/[^a-z-]/g,'').slice(0,60),disposition:report.disposition==='enforce'?'enforce':'report'}));
 return res.status(204).end();
}
export default secureHandler(handler,{path:'/api/csp-report'});
