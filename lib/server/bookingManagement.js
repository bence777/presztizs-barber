import { bookingDb, BookingDbError } from './bookingDb';
import { getGuest } from './guestAuth';

export const DEFAULT_SALON_EMAIL = 'bencebalogh7777@gmail.com';

export async function managerFor(req, res) {
  const guest = await getGuest(req,res);
  if (!guest) return {guest:null,manager:null};
  const email = guest.user.email.trim().toLowerCase();
  const rows = await bookingDb('booking_managers', {query:{select:'email,role,staff_id',email:`eq.${email}`,active:'eq.true',limit:'1'}});
  return {guest, manager:rows[0] || null};
}

export async function requireManager(req,res) {
  const context = await managerFor(req,res);
  if (!context.guest) {res.status(401).json({error:'A belépéshez kérj e-mailes kódot.'});return null;}
  if (!context.manager) {res.status(403).json({error:'Ehhez a felülethez nincs kezelői jogosultságod.'});return null;}
  return context;
}

export function appointmentQueryFields() {
  return 'id,user_id,staff_id,service_id,starts_at,ends_at,price_huf,status,created_at,cancelled_at,guest_email';
}
export async function decorateAppointments(appointments, {includeGuest = false} = {}) {
  const staffIds = [...new Set(appointments.map(b=>b.staff_id))];
  const serviceIds = [...new Set(appointments.map(b=>b.service_id))];
  const [staff,services] = await Promise.all([
    staffIds.length ? bookingDb('booking_staff',{query:{select:'id,name,email',id:`in.(${staffIds.join(',')})`}}) : [],
    serviceIds.length ? bookingDb('booking_services',{query:{select:'id,name,duration_minutes',id:`in.(${serviceIds.join(',')})`}}) : [],
  ]);
  const staffMap=new Map(staff.map(s=>[s.id,s]));
  const servicesMap=new Map(services.map(s=>[s.id,s]));
  let profiles = [];
  if(includeGuest && appointments.length) {
    const ids=[...new Set(appointments.map(b=>b.user_id))];
    profiles=await bookingDb('guest_profiles',{query:{select:'user_id,full_name,phone',user_id:`in.(${ids.join(',')})`}});
  }
  const profileMap=new Map(profiles.map(p=>[p.user_id,p]));
  return appointments.map(b=>({
    ...b,staff_name:staffMap.get(b.staff_id)?.name || 'Barber',
    service_name:servicesMap.get(b.service_id)?.name || 'Szolgáltatás',
    ...(includeGuest?{guest_name:profileMap.get(b.user_id)?.full_name || 'Vendég',guest_phone:profileMap.get(b.user_id)?.phone || ''}:{guest_email:undefined,user_id:undefined}),
  }));
}

export async function updateBookingStatus(id, status, {userId, manager} = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BookingDbError(400,'invalid_id');
  if (!['cancelled','completed','no_show'].includes(status)) throw new BookingDbError(400,'invalid_status');
  const query={id:`eq.${id}`,status:'eq.confirmed',select:appointmentQueryFields()};
  if (userId) query.user_id=`eq.${userId}`;
  if (manager?.role==='barber') query.staff_id=`eq.${manager.staff_id}`;
  const existing=await bookingDb('booking_appointments',{query:{...query,limit:'1'}});
  const booking=existing[0];
  if(!booking) throw new BookingDbError(404,'not_found');
  // Guests cannot cancel appointments after the start. The 2-hour cutoff can be tightened here.
  if(userId && new Date(booking.starts_at).getTime()<=Date.now()) throw new BookingDbError(409,'already_started');
  if(!userId && status!=='cancelled' && new Date(booking.starts_at).getTime()>Date.now()) throw new BookingDbError(409,'not_started');
  const updated=await bookingDb('booking_appointments',{
    method:'PATCH',
    query:{...query,select:appointmentQueryFields()},
    prefer:'return=representation',
    body:{status,...(status==='cancelled'?{cancelled_at:new Date().toISOString()}:{})},
  });
  if(updated.length!==1) throw new BookingDbError(409,'already_changed');
  return updated[0];
}

export async function notificationRecipients(staffId) {
  const staff=await bookingDb('booking_staff',{query:{select:'email',id:`eq.${staffId}`,limit:'1'}});
  const email=staff[0]?.email?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : DEFAULT_SALON_EMAIL;
}
