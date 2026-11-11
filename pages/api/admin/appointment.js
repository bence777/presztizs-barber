import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {createAdminAppointment,editAdminAppointment,deleteAdminAppointment,adminMutationError} from '../../../lib/server/adminCalendar';
import {emailBookingReceipt,emailBookingUpdate,emailBookingRemoved} from '../../../lib/server/bookingEmail';
export const config={api:{bodyParser:{sizeLimit:'8kb'}}};
export default async function handler(req,res) {
  if(!['POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'Nem támogatott művelet.'});
  if(!jsonOnly(req,res,req.method))return;
  try {
    const session=await requireManager(req,res);if(!session)return;
    const {id,...payload}=req.body||{};
    const notify=payload.notify===true;
    let booking;
    if(req.method==='POST')booking=await createAdminAppointment(payload,session.manager);
    else if(req.method==='PATCH')booking=await editAdminAppointment(id,payload,session.manager);
    else booking=await deleteAdminAppointment(id,session.manager);
    let emailSent=null;
    if(notify){
      try {
        if(req.method==='POST')emailSent=await emailBookingReceipt({email:booking.guest_email,name:booking.guest_name,booking});
        if(req.method==='PATCH')emailSent=await emailBookingUpdate({booking});
        if(req.method==='DELETE')emailSent=await emailBookingRemoved({booking});
      }catch(e){console.error('[admin/appointment] notification',e.message)}
    }
    return res.status(req.method==='POST'?201:200).json({booking,emailSent});
  }catch(e){return adminMutationError(res,e)}
}
