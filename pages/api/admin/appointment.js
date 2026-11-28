import {secureHandler} from '../../../lib/server/security';
import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {createAdminAppointment,editAdminAppointment,deleteAdminAppointment,stopMonthlyAppointments,adminMutationError} from '../../../lib/server/adminCalendar';
export const config={api:{bodyParser:{sizeLimit:'8kb'}}};
async function handler(req,res) {
  if(!['POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'Nem támogatott művelet.'});
  if(!jsonOnly(req,res,req.method))return;
  try {
    const session=await requireManager(req,res);if(!session)return;
    const {id,...payload}=req.body||{};
    const notify=payload.notify===true&&payload.stopMonthly!==true;
    let booking;
    if(req.method==='POST')booking=await createAdminAppointment(payload,session.manager);
    else if(req.method==='PATCH')booking=await editAdminAppointment(id,payload,session.manager);
    else booking=payload.stopMonthly===true?await stopMonthlyAppointments(id,session.manager,payload.revision):await deleteAdminAppointment(id,session.manager,payload.revision);
    const emailSent=null;
    return res.status(req.method==='POST'?201:200).json({booking,emailSent});
  }catch(e){return adminMutationError(res,e)}
}

export default secureHandler(handler,{path:'/api/admin/appointment'});
