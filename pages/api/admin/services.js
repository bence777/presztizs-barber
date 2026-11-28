import {secureHandler} from '../../../lib/server/security';
import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {adminMutationError} from '../../../lib/server/adminCalendar';
import {readServices,saveService} from '../../../lib/server/staffSettings';
export const config={api:{bodyParser:{sizeLimit:'12kb'}}};
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return res.status(405).end();
 if(req.method!=='GET'&&!jsonOnly(req,res,req.method))return;
 try{
  const session=await requireManager(req,res);if(!session)return;
  if(req.method==='GET')return res.json({services:await readServices(session.manager,req.query.staffId)});
  if(req.method!=='POST'&&!req.body?.id)return res.status(400).json({error:'Hiányzó szolgáltatásazonosító.'});
  const payload={...req.body,...(req.method==='POST'?{id:undefined}:{})};
  return res.status(req.method==='POST'?201:200).json({service:await saveService(session.manager,payload,{archive:req.method==='DELETE'})});
 }catch(e){return adminMutationError(res,e)}
}

export default secureHandler(handler,{path:'/api/admin/services'});
