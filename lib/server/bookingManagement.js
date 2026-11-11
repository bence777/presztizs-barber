import { bookingDb, BookingDbError } from './bookingDb.js';
import { getAdmin } from './adminAuth.js';

export const DEFAULT_SALON_EMAIL = 'bencebalogh7777@gmail.com';

export async function managerByEmail(email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalized || normalized.length > 254) return null;
  const rows = await bookingDb('booking_managers', {
    query: { select:'email,role,staff_id',email:`eq.${normalized}`,active:'eq.true',limit:'1' },
  });
  return rows[0] || null;
}

export async function managerFor(req, res) {
  // Dedicated staff identity: independent from guest sessions.
  const admin = await getAdmin(req, res);
  if (!admin) return { admin:null, manager:null };
  const manager = await managerByEmail(admin.user.email);
  return { admin, manager };
}

export async function requireManager(req, res) {
  const context = await managerFor(req, res);
  if (!context.admin) {
    res.status(401).json({ error:'Előbb lépj be a szalon kezelői fiókjába.' });
    return null;
  }
  if (!context.manager) {
    res.status(403).json({ error:'A bejelentkezett fiókhoz nincs aktív kezelői jogosultság.' });
    return null;
  }
  return context;
}

export function appointmentQueryFields() {
  return 'id,user_id,staff_id,service_id,starts_at,ends_at,price_huf,status,created_at,cancelled_at,guest_email,guest_name,guest_phone,is_manual,is_demo';
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
    const ids=[...new Set(appointments.map(b=>b.user_id).filter(Boolean))];
    profiles=ids.length ? await bookingDb('guest_profiles',{query:{select:'user_id,full_name,phone',user_id:`in.(${ids.join(',')})`}}) : [];
  }
  const profileMap=new Map(profiles.map(p=>[p.user_id,p]));
  return appointments.map(b=>({
    ...b,staff_name:staffMap.get(b.staff_id)?.name || 'Barber',
    service_name:servicesMap.get(b.service_id)?.name || 'Szolgáltatás',
    ...(includeGuest?{guest_name:b.guest_name || profileMap.get(b.user_id)?.full_name || 'Vendég',guest_phone:b.guest_phone || profileMap.get(b.user_id)?.phone || ''}:{guest_email:undefined,user_id:undefined}),
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

// Link manually entered appointments after the guest verifies ownership of their email.
// Existing user_id links are never reassigned. This also makes guest cancellation work.
export async function claimManualAppointments(guest) {
  const email=guest?.user?.email?.trim().toLowerCase();
  if (!email) return;
  await bookingDb('booking_appointments', {
    method:'PATCH',
    query:{user_id:'is.null',is_manual:'eq.true',guest_email:`eq.${email}`},
    prefer:'return=minimal',
    body:{user_id:guest.user.id},
  });
}
