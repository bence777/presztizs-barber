import {bookingDb, BookingDbError, localToUtcMs} from './bookingDb.js';
import {appointmentQueryFields,decorateAppointments} from './bookingManagement.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DAY=/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES=new Set(['confirmed','cancelled','completed','no_show']);

const trim=(x,max=200)=>typeof x==='string'?x.trim().slice(0,max):'';
const error=(code,message,status=400)=>{throw new BookingDbError(status,code,message)};

function dayToTimestamp(day) {
  if (!ISO_DAY.test(day||'')) return null;
  const ms=localToUtcMs(day,'00:00');
  return ms===null?null:ms;
}
function nextDay(day) {
  const [y,m,d]=day.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
}
export function parseCalendarRange(from,to) {
  const start=dayToTimestamp(from);
  const end=dayToTimestamp(to);
  if (start===null||end===null||end<=start||end-start>122*86400000) error('range','Hibás időszak (legfeljebb 120 nap).');
  return {start:new Date(start).toISOString(),end:new Date(end).toISOString()};
}
export async function readCalendar({manager,from,to}) {
  const range=parseCalendarRange(from,to);
  const query={select:appointmentQueryFields(),and:`(starts_at.gte.${range.start},starts_at.lt.${range.end})`,order:'starts_at.asc',limit:'2001'};
  if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  const bookings=await bookingDb('booking_appointments',{query});
  if(bookings.length>2000)error('too_many','Túl sok foglalás. Válassz rövidebb időszakot.',413);
  return decorateAppointments(bookings,{includeGuest:true});
}
export async function calendarOptions(manager) {
  const [services,staff]=await Promise.all([
    bookingDb('booking_services',{query:{select:'id,name,duration_minutes,price_huf,active',order:'sort_order.asc,name.asc'}}),
    bookingDb('booking_staff',{query:{select:'id,name,role,active',order:'sort_order.asc,name.asc'}}),
  ]);
  return {services,staff:manager.role==='owner'?staff:staff.filter(s=>s.id===manager.staff_id),manager:{role:manager.role,staff_id:manager.staff_id}};
}

function dataFromPayload(payload,manager) {
  const staffId=trim(payload.staffId,80);
  const serviceId=trim(payload.serviceId,80);
  const date=trim(payload.date,12),time=trim(payload.time,5);
  const guestName=trim(payload.guestName,120);
  const guestEmail=trim(payload.guestEmail,254).toLowerCase();
  const guestPhone=trim(payload.guestPhone,24);
  const status=trim(payload.status,30)||'confirmed';
  if (!staffId||!serviceId||!TIME.test(time)||!ISO_DAY.test(date)||!guestName||guestName.length<2||!STATUSES.has(status))error('invalid_form','Töltsd ki a kötelező mezőket.');
  if(guestEmail&&!EMAIL.test(guestEmail))error('invalid_email','Érvénytelen vendég e-mail-cím.');
  if(guestPhone&&guestPhone.length<7)error('invalid_phone','A telefonszám túl rövid.');
  if(manager.role==='barber'&&manager.staff_id!==staffId)error('access_denied','Másik barber foglalását nem kezelheted.',403);
  const start=localToUtcMs(date,time);
  if (start===null)error('invalid_time','Nem létező vagy hibás helyi időpont.');
  return {staffId,serviceId,guestName,guestEmail,guestPhone,status,start};
}
async function getServiceAndStaff(data) {
  const [services,staff]=await Promise.all([
    bookingDb('booking_services',{query:{select:'id,name,duration_minutes,price_huf',id:`eq.${data.serviceId}`,limit:'1'}}),
    bookingDb('booking_staff',{query:{select:'id,name',id:`eq.${data.staffId}`,limit:'1'}}),
  ]);
  if(!services[0]||!staff[0])error('not_found','A szolgáltatás vagy barber már nem található.',404);
  return services[0];
}
async function existingIdForEmail(email) {
  if (!email) return null;
  // Only link an admin-created appointment to an existing mini-profile when a previous
  // verified reservation already stores that exact email + auth user ID.
  const list=await bookingDb('booking_appointments',{query:{select:'user_id',guest_email:`eq.${email}`,user_id:'not.is.null',limit:'1'}});
  return list[0]?.user_id||null;
}
function dataToBooking(data,service,{userId=null,original=null}={}) {
  const startIso=new Date(data.start).toISOString();
  return {
    staff_id:data.staffId,service_id:data.serviceId,starts_at:startIso,
    ends_at:new Date(data.start+service.duration_minutes*60000).toISOString(),
    price_huf:service.price_huf,status:data.status,
    guest_name:data.guestName,guest_email:data.guestEmail||null,guest_phone:data.guestPhone||null,
    user_id:userId,
    is_manual:original?original.is_manual:true,
    cancelled_at:data.status==='cancelled'?(original?.cancelled_at||new Date().toISOString()):null,
  };
}
export async function createAdminAppointment(payload,manager) {
  const data=dataFromPayload(payload,manager);
  const service=await getServiceAndStaff(data);
  const linkedUserId=await existingIdForEmail(data.guestEmail);
  const rows=await bookingDb('booking_appointments',{method:'POST',prefer:'return=representation',query:{select:appointmentQueryFields()},body:dataToBooking(data,service,{userId:linkedUserId})});
  return (await decorateAppointments(rows,{includeGuest:true}))[0];
}
async function findExisting(id,manager) {
  if (!UUID.test(id||''))error('invalid_id','Hibás foglalási azonosító.');
  const query={select:appointmentQueryFields(),id:`eq.${id}`,limit:'1'};
  if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  const found=await bookingDb('booking_appointments',{query});
  if(!found.length)error('missing','Nincs jogosultságod ehhez a foglaláshoz, vagy már törölték.',404);
  return found[0];
}
export async function editAdminAppointment(id,payload,manager) {
  const original=await findExisting(id,manager);
  const data=dataFromPayload(payload,manager);
  const service=await getServiceAndStaff(data);
  const newUserId= data.guestEmail&&original.guest_email?.toLowerCase()===data.guestEmail
    ? original.user_id : (await existingIdForEmail(data.guestEmail));
  const body=dataToBooking(data,service,{userId:newUserId,original});
  const query={id:`eq.${id}`,select:appointmentQueryFields()};
  if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  const rows=await bookingDb('booking_appointments',{method:'PATCH',prefer:'return=representation',query,body});
  if(rows.length!==1)error('missing','A foglalás közben módosult.',409);
  return (await decorateAppointments(rows,{includeGuest:true}))[0];
}
export async function deleteAdminAppointment(id,manager) {
  const original=await findExisting(id,manager);
  const query={id:`eq.${id}`,select:'id'};
  if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  const rows=await bookingDb('booking_appointments',{method:'DELETE',prefer:'return=representation',query});
  if(rows.length!==1)error('missing','A foglalás közben már törlődött.',409);
  return (await decorateAppointments([original],{includeGuest:true}))[0];
}
export function adminMutationError(res,e) {
  if(e instanceof BookingDbError){
    if(e.code==='23P01'||e.code==='23505')return res.status(409).json({error:'Ütköző foglalás: az adott barber vagy vendég már foglalt ebben az időszakban.'});
    if(e.code==='23503')return res.status(409).json({error:'A választott szolgáltatás vagy barber már nem elérhető.'});
    if([400,403,404,409,413].includes(e.status))return res.status(e.status).json({error:e.message||'A kérés nem végrehajtható.'});
  }
  console.error('[admin/calendar]',e?.code||e?.message||e);
  return res.status(503).json({error:'Adatbázishiba történt. Próbáld újra.'});
}
