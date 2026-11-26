import { bookingDb, BookingDbError } from './bookingDb.js';
import { getAdmin } from './adminAuth.js';
import {deviceCredential} from './trustedDevices.js';

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
  if (manager) {
    assertManager(manager);
    // Non-enumerable: never serialize the staff JWT into API responses.
    Object.defineProperty(manager, 'bearer', {value:admin.token});
    Object.defineProperty(manager, 'adminDevice', {value:deviceCredential(req,'admin')});
  }
  return { admin, manager };
}

export function assertManager(manager) {
  if (!manager || !['owner','barber'].includes(manager.role) ||
      (manager.role === 'barber' && !/^[a-z0-9][a-z0-9-]{1,60}$/.test(manager.staff_id || ''))) {
    throw new BookingDbError(403,'access_denied','Nincs érvényes kezelői jogosultság.');
  }
  return manager;
}
export function scopedStaff(manager, requested) {
  assertManager(manager);
  if (requested && requested !== 'all' && !/^[a-z0-9][a-z0-9-]{1,60}$/.test(requested))
    throw new BookingDbError(400,'invalid_staff','Hibás fodrászazonosító.');
  if (manager.role === 'barber') {
    if (requested && requested !== 'all' && requested !== manager.staff_id)
      throw new BookingDbError(403,'access_denied','Más fodrász adataihoz nincs hozzáférésed.');
    return manager.staff_id;
  }
  return requested && requested !== 'all' ? requested : null;
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
  return 'id,user_id,staff_id,service_id,starts_at,ends_at,price_huf,service_name_snapshot,duration_minutes_snapshot,status,created_at,cancelled_at,completed_at,guest_email,guest_name,guest_phone,is_manual,is_demo,monthly_series_id,monthly_date';
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
  // Staff sees the contact snapshot on authorized appointments, never an arbitrary
  // global guest profile supplied via a forged user_id. Migration backfills old rows.
  return appointments.map(b=>({
    ...b,staff_name:staffMap.get(b.staff_id)?.name || 'Barber',
    service_name:b.service_name_snapshot || servicesMap.get(b.service_id)?.name || 'Szolgáltatás',
    ...(includeGuest?{guest_name:b.guest_name || 'Vendég',guest_phone:b.guest_phone || ''}:{guest_email:undefined,user_id:undefined}),
  }));
}

export async function updateBookingStatus(id, status, {userId, manager} = {}) {
  if (!userId) assertManager(manager);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BookingDbError(400,'invalid_id');
  if (!['cancelled','completed','no_show'].includes(status)) throw new BookingDbError(400,'invalid_status');
  const query={id:`eq.${id}`,status:'eq.confirmed',select:appointmentQueryFields()};
  if (userId) query.user_id=`eq.${userId}`;
  if (manager?.role==='barber') query.staff_id=`eq.${manager.staff_id}`;
  const existing=await bookingDb('booking_appointments',{bearer:manager?.bearer,adminDevice:manager?.adminDevice,query:{...query,limit:'1'}});
  const booking=existing[0];
  if(!booking) throw new BookingDbError(404,'not_found');
  // Guests cannot cancel appointments after the start. The 2-hour cutoff can be tightened here.
  if(userId && new Date(booking.starts_at).getTime()<=Date.now()) throw new BookingDbError(409,'already_started');
  if(!userId && status!=='cancelled' && new Date(booking.starts_at).getTime()>Date.now()) throw new BookingDbError(409,'not_started');
  const updated=await bookingDb('booking_appointments',{
    method:'PATCH',
    bearer:manager?.bearer,adminDevice:manager?.adminDevice,
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
