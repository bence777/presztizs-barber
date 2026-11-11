import {jsonOnly} from '../../../lib/server/guestAuth';
import {bookingDb} from '../../../lib/server/bookingDb';
import {requireManager,decorateAppointments,appointmentQueryFields} from '../../../lib/server/bookingManagement';
export default async function handler(req,res) {
  if(!jsonOnly(req,res,'GET'))return;
  try {
    const session=await requireManager(req,res);if(!session)return;
    const selectedId=typeof req.query.booking==='string'?req.query.booking:null;
    if(selectedId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedId)) return res.status(400).json({error:'Érvénytelen foglalási azonosító.'});
    if(selectedId) {
      const query={select:appointmentQueryFields(),id:`eq.${selectedId}`,limit:'1'};
      if(session.manager.role==='barber') query.staff_id=`eq.${session.manager.staff_id}`;
      const rows=await bookingDb('booking_appointments',{query});
      const bookings=await decorateAppointments(rows,{includeGuest:true});
      return res.status(200).json({bookings,hasMore:false,page:0});
    }
    const page=Math.max(0,Math.min(1000,Number.parseInt(req.query.page,10)||0));
    const query={select:appointmentQueryFields(),order:'starts_at.desc',limit:'21',offset:String(page*20)};
    if(session.manager.role==='barber')query.staff_id=`eq.${session.manager.staff_id}`;
    const rows=await bookingDb('booking_appointments',{query});
    const hasMore=rows.length>20;
    const bookings=await decorateAppointments(rows.slice(0,20),{includeGuest:true});
    return res.status(200).json({bookings,hasMore,page,manager:{role:session.manager.role,staff_id:session.manager.staff_id,email:session.manager.email}});
  }catch(e){console.error('[admin/bookings]',e.message);return res.status(503).json({error:'Nem sikerült betölteni a foglalásokat.'});}
}
