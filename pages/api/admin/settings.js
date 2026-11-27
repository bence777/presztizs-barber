import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {adminMutationError} from '../../../lib/server/adminCalendar';
import {readSettings,saveSettings} from '../../../lib/server/staffSettings';
export const config={api:{bodyParser:{sizeLimit:'80kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','PATCH'].includes(req.method))return res.status(405).end();
 if(req.method==='PATCH'&&!jsonOnly(req,res,'PATCH'))return;
 try{
  const session=await requireManager(req,res);if(!session)return;
  return res.json(req.method==='GET'?await readSettings(session.manager,req.query.staffId):await saveSettings(session.manager,req.body||{}));
 }catch(e){return adminMutationError(res,e)}
}
