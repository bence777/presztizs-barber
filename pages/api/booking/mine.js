import {getGuest,jsonOnly} from '../../../lib/server/guestAuth';
import {bookingDb} from '../../../lib/server/bookingDb';
import {appointmentQueryFields,decorateAppointments,claimManualAppointments} from '../../../lib/server/bookingManagement';
export default async function handler(req,res) {
  if(!jsonOnly(req,res,'GET'))return;
  try {
    const guest=await getGuest(req,res);
    if(!guest)return res.status(401).json({error:'Jelentkezz be e-mailes kóddal.'});
    try{await claimManualAppointments(guest)}catch(err){console.warn('[booking/mine] Could not link manual appointments:',err.code||err.message)}
    const selectedId=typeof req.query.booking==='string'?req.query.booking:null;
    if(selectedId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedId)) return res.status(400).json({error:'Érvénytelen foglalási azonosító.'});
    if(selectedId) {
      const rows=await bookingDb('booking_appointments',{query:{select:appointmentQueryFields(),user_id:`eq.${guest.user.id}`,id:`eq.${selectedId}`,limit:'1'}});
      return res.status(200).json({bookings:await decorateAppointments(rows),hasMore:false,page:0});
    }
    const page=Math.max(0,Math.min(1000,Number.parseInt(req.query.page,10)||0));
    const rows=await bookingDb('booking_appointments',{query:{select:appointmentQueryFields(),user_id:`eq.${guest.user.id}`,order:'starts_at.desc',limit:'21',offset:String(page*20)}});
    const hasMore=rows.length>20;
    const bookings=await decorateAppointments(rows.slice(0,20));
    res.status(200).json({bookings,hasMore,page});
  } catch(e){console.error('[booking/mine]',e.message);res.status(503).json({error:'Nem sikerült betölteni a foglalásokat.'});}
}
