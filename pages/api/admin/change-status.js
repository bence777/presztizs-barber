import {jsonOnly} from '../../../lib/server/guestAuth';
import {BookingDbError} from '../../../lib/server/bookingDb';
import {requireManager,updateBookingStatus,decorateAppointments} from '../../../lib/server/bookingManagement';
import {emailBookingChange} from '../../../lib/server/bookingEmail';
export default async function handler(req,res) {
  if(!jsonOnly(req,res,'POST'))return;
  const {id,status}=req.body||{};
  if(typeof id!=='string'||!['cancelled','completed','no_show'].includes(status))return res.status(400).json({error:'Érvénytelen kérés.'});
  try {
    const session=await requireManager(req,res);if(!session)return;
    const updated=await updateBookingStatus(id,status,{manager:session.manager});
    const [booking]=await decorateAppointments([updated],{includeGuest:true});
    let emailSent={guest:false,staff:false};
    try {emailSent=await emailBookingChange({booking,guestEmail:booking.guest_email,guestName:booking.guest_name,changedBy:'manager'});}
    catch(e){console.error('[admin/change-status] email',e.message);}
    return res.status(200).json({booking,emailSent});
  }catch(e){
    if(e instanceof BookingDbError && [404,409].includes(e.status))return res.status(e.status).json({error:'A foglalás már módosult, vagy nincs jogosultságod kezelni.'});
    if(e instanceof BookingDbError && e.status===400)return res.status(400).json({error:'Hibás adat.'});
    console.error('[admin/change-status]',e.message);return res.status(503).json({error:'Nem sikerült menteni a módosítást.'});
  }
}
