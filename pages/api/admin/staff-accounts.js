import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {readStaffAccounts,saveStaffAccount,setEmailStaffAccess} from '../../../lib/server/staffAccounts';
import {adminMutationError} from '../../../lib/server/adminCalendar';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return res.status(405).json({error:'Nem támogatott művelet.'});}
 if(!jsonOnly(req,res,req.method))return;
 try {const context=await requireManager(req,res);if(!context)return;
  if(req.method==='GET')return res.status(200).json(await readStaffAccounts(context.manager));
  const account=req.method==='PATCH'?await setEmailStaffAccess(req.body||{},context.manager):await saveStaffAccount(req.body||{},context.manager);
  return res.status(200).json({account});
 }catch(e){return adminMutationError(res,e)}
}
