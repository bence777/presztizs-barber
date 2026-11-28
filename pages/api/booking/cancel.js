import {secureHandler} from '../../../lib/server/security';
import {getGuest,getProfile,jsonOnly} from '../../../lib/server/guestAuth';
import {bookingDb,BookingDbError} from '../../../lib/server/bookingDb';
import {updateBookingStatus,decorateAppointments} from '../../../lib/server/bookingManagement';
async function handler(req,res) {
  if(!jsonOnly(req,res,'POST'))return;
  const id=req.body?.id;
  if(typeof id!=='string')return res.status(400).json({error:'Hiányzik a foglalási azonosító.'});
  try {
    const guest=await getGuest(req,res);
    if(!guest)return res.status(401).json({error:'Jelentkezz be e-mailes kóddal.'});
    const booking=await updateBookingStatus(id,'cancelled',{userId:guest.user.id});
    const [decorated]=await decorateAppointments([booking]);
    const emailSent=null;
    return res.status(200).json({booking:decorated,emailSent});
  }catch(e){
    if(e instanceof BookingDbError && e.status===404)return res.status(404).json({error:'Nincs ilyen aktív foglalásod.'});
    if(e instanceof BookingDbError && e.status===409)return res.status(409).json({error:'Online lemondás legkésőbb az időpont előtt 4 órával lehetséges. / Online cancellation closes 4 hours before the appointment.'});
    console.error('[booking/cancel]',e.message);return res.status(503).json({error:'Nem sikerült lemondani a foglalást.'});
  }
}

export default secureHandler(handler,{path:'/api/booking/cancel'});
