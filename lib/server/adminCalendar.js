import {revisionFilter,revisionConflict} from './revision.js';
import {bookingDb,bookingDbRows,materializeMonthly, BookingDbError, localToUtcMs,localDay} from './bookingDb.js';
import {appointmentQueryFields,decorateAppointments,scopedStaff} from './bookingManagement.js';
import {readTimeOff,expandTimeOff} from './timeOff.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DAY=/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES=new Set(['confirmed','cancelled','completed','no_show']);

const trim=(x,max=200)=>typeof x==='string'?x.trim().slice(0,max):'';
const error=(code,message,status=400)=>{throw new BookingDbError(status,code,message)};

function dayToTimestamp(day) {
  if (typeof day!=='string'||!ISO_DAY.test(day)) return null;
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
export async function readCalendar({manager,from,to,staffId}) {
  const staff=scopedStaff(manager,staffId);
  const range=parseCalendarRange(from,to);
  await materializeMonthly(from,to,staff);
  const query={select:appointmentQueryFields()+(staff?'':',booking_staff!inner(active)'),...(!staff?{'booking_staff.active':'eq.true'}:{}),and:`(starts_at.gte.${range.start},starts_at.lt.${range.end})`,order:'starts_at.asc,id.asc'};
  if(staff)query.staff_id=`eq.${staff}`;
  const bookings=await bookingDbRows('booking_appointments',{bearer:manager.bearer,adminDevice:manager.adminDevice,query,maxRows:2000});
  if(bookings.length>2000)error('too_many','Túl sok foglalás. Válassz rövidebb időszakot.',413);
  return decorateAppointments(bookings,{includeGuest:true});
}
export async function calendarOptions(manager) {
  const staffId=scopedStaff(manager);
  const [services,staff]=await Promise.all([
    bookingDb('booking_services',{bearer:manager.bearer,adminDevice:manager.adminDevice,query:{select:'id,staff_id,name,duration_minutes,price_huf,active,archived_at',...(staffId?{staff_id:`eq.${staffId}`}:{ }),order:'sort_order.asc,name.asc'}}),
    bookingDb('booking_staff',{bearer:manager.bearer,adminDevice:manager.adminDevice,query:{select:'id,name,role,active,default_manual_service_id,booking_step_minutes',active:'eq.true',...(staffId?{id:`eq.${staffId}`}:{ }),order:'sort_order.asc,name.asc'}}),
  ]);
  return {services,staff:manager.role==='owner'?staff:staff.filter(s=>s.id===manager.staff_id),manager:{role:manager.role,staff_id:manager.staff_id}};
}

function dataFromPayload(payload,manager) {
  scopedStaff(manager,payload.staffId);
  const staffId=trim(payload.staffId||manager.staff_id,80);
  const serviceId=trim(payload.serviceId,80);
  const date=trim(payload.date,12),time=trim(payload.time,5);
  const guestName=trim(payload.guestName,120);
  const guestEmail=trim(payload.guestEmail,254).toLowerCase();
  const guestPhone=trim(payload.guestPhone,24);
  const status=trim(payload.status,30)||'confirmed';
  if (!staffId||!serviceId||!TIME.test(time)||!ISO_DAY.test(date)||!guestName||guestName.length<1||!STATUSES.has(status))error('invalid_form','Töltsd ki a kötelező mezőket.');
  if(guestEmail&&!EMAIL.test(guestEmail))error('invalid_email','Érvénytelen vendég e-mail-cím.');
  if(guestPhone&&!/^\+?[\d\s()/-]{7,24}$/.test(guestPhone))error('invalid_phone','Érvénytelen telefonszám.');
  if(manager.role==='barber'&&manager.staff_id!==staffId)error('access_denied','Másik barber foglalását nem kezelheted.',403);
  const start=localToUtcMs(date,time);
  if (start===null)error('invalid_time','Nem létező vagy hibás helyi időpont.');
  if(['completed','no_show'].includes(status)&&start>Date.now())error('not_started','Jövőbeli foglalás még nem jelölhető teljesítettnek.');
  const duration=payload.durationMinutes===undefined?null:payload.durationMinutes;
  if(duration!==null&&(!Number.isSafeInteger(duration)||duration<=0||duration>2147483647))error('invalid_duration','Az időtartam pozitív egész perc legyen.');
  return {staffId,serviceId,guestName,guestEmail,guestPhone,status,start,duration};
}
async function getServiceAndStaff(data,manager,{allowInactive=false}={}) {
  const [services,staff]=await Promise.all([
    bookingDb('booking_services',{bearer:manager.bearer,adminDevice:manager.adminDevice,query:{select:'id,staff_id,name,duration_minutes,price_huf,active,archived_at',staff_id:`eq.${data.staffId}`,id:`eq.${data.serviceId}`,limit:'1'}}),
    bookingDb('booking_staff',{bearer:manager.bearer,adminDevice:manager.adminDevice,query:{select:'id,name,active',id:`eq.${data.staffId}`,limit:'1'}}),
  ]);
  if(!services[0]||!staff[0])error('not_found','A szolgáltatás vagy barber már nem található.',404);
  if(services[0].staff_id!==data.staffId)error('wrong_service','A szolgáltatás nem ehhez a fodrászhoz tartozik.');
  if(!allowInactive&&(services[0].active===false||services[0].archived_at||staff[0].active===false))error('inactive','Inaktív szolgáltatáshoz vagy fodrászhoz nem lehet új időpontot rögzíteni.');
  return {...services[0],duration_minutes:data.duration??services[0].duration_minutes};
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
    price_huf:service.price_huf,service_name_snapshot:service.name,duration_minutes_snapshot:service.duration_minutes,status:data.status,
    guest_name:data.guestName,guest_email:data.guestEmail||null,guest_phone:data.guestPhone||null,
    user_id:userId,
    is_manual:original?original.is_manual:true,
    cancelled_at:data.status==='cancelled'?(original?.cancelled_at||new Date().toISOString()):null,
  };
}
export async function createAdminAppointment(payload,manager) {
  if(!payload.serviceId){
    const staffId=scopedStaff(manager,payload.staffId)||payload.staffId;
    const staff=await bookingDb('booking_staff',{bearer:manager.bearer,adminDevice:manager.adminDevice,query:{select:'default_manual_service_id',id:`eq.${staffId}`,limit:'1'}});
    payload={...payload,staffId,serviceId:staff[0]?.default_manual_service_id};
  }
  const data=dataFromPayload(payload,manager);
  if(payload.repeatMonthly!==undefined&&typeof payload.repeatMonthly!=='boolean')error('invalid_repeat','Hibás ismétlődési beállítás.');
  if(payload.repeatMonthly&&data.status!=='confirmed')error('invalid_repeat','Csak megerősített foglalás ismétlődhet havonta.');
  const service=await getServiceAndStaff(data,manager);
  await validateAdminSlot(data,service,manager);
  const linkedUserId=await existingIdForEmail(data.guestEmail);
  const body=dataToBooking(data,service,{userId:linkedUserId});
  const rows=await bookingDb(payload.repeatMonthly?'rpc/booking_create_monthly':'booking_appointments',{method:'POST',bearer:manager.bearer,adminDevice:manager.adminDevice,prefer:'return=representation',query:payload.repeatMonthly?{}:{select:appointmentQueryFields()},body:payload.repeatMonthly?{p_booking:body}:body});
  return (await decorateAppointments(rows,{includeGuest:true}))[0];
}
async function findExisting(id,manager) {
  scopedStaff(manager);
  if (!UUID.test(id||''))error('invalid_id','Hibás foglalási azonosító.');
  const query={select:appointmentQueryFields(),id:`eq.${id}`,limit:'1'};
  if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  const found=await bookingDb('booking_appointments',{bearer:manager.bearer,adminDevice:manager.adminDevice,query});
  if(!found.length)error('missing','Nincs jogosultságod ehhez a foglaláshoz, vagy már törölték.',404);
  return found[0];
}
export async function editAdminAppointment(id,payload,manager) {
  const original=await findExisting(id,manager);
  const data=dataFromPayload(payload,manager);
  const sameService=original.staff_id===data.staffId&&original.service_id===data.serviceId;
  const originalDuration=(Date.parse(original.ends_at)-Date.parse(original.starts_at))/60000;
  if(sameService&&data.duration===null)data.duration=originalDuration;
  const moved=!sameService||new Date(original.starts_at).getTime()!==data.start||data.duration!==originalDuration;
  const service=await getServiceAndStaff(data,manager,{allowInactive:sameService});
  if(moved||(original.status==='cancelled'&&data.status!=='cancelled'))await validateAdminSlot(data,service,manager,id);
  const newUserId= data.guestEmail&&original.guest_email?.toLowerCase()===data.guestEmail
    ? original.user_id : (await existingIdForEmail(data.guestEmail));
  const body=dataToBooking(data,service,{userId:newUserId,original});
  if(sameService){body.price_huf=original.price_huf;body.service_name_snapshot=original.service_name_snapshot;}
  const query={id:`eq.${id}`,revision:revisionFilter(payload.revision),select:appointmentQueryFields()};
  if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  const rows=await bookingDb('booking_appointments',{method:'PATCH',bearer:manager.bearer,adminDevice:manager.adminDevice,prefer:'return=representation',query,body});
  if(rows.length!==1)error('missing','A foglalás közben módosult.',409);
  return (await decorateAppointments(rows,{includeGuest:true}))[0];
}
export async function deleteAdminAppointment(id,manager,revision) {
  const original=await findExisting(id,manager);
  const query={id:`eq.${id}`,revision:revisionFilter(revision),select:'id'};
  if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  const rows=await bookingDb('booking_appointments',{method:'DELETE',bearer:manager.bearer,adminDevice:manager.adminDevice,prefer:'return=representation',query});
  if(rows.length!==1)error('missing','A foglalás közben már törlődött.',409);
  return (await decorateAppointments([original],{includeGuest:true}))[0];
}
export async function stopMonthlyAppointments(id,manager,revision) {
  const original=await findExisting(id,manager);
  if(!original.monthly_series_id)error('invalid_repeat','Ez a foglalás nem ismétlődik.');
  await bookingDb('rpc/booking_stop_monthly',{method:'POST',bearer:manager.bearer,adminDevice:manager.adminDevice,body:{p_id:id,p_revision:revision}});
  return (await decorateAppointments([original],{includeGuest:true}))[0];
}
export function adminMutationError(res,e) {
  if(e instanceof BookingDbError){
    if(e.code==='40001')return res.status(409).json({error:'Időközben más módosította az adatot. Töltsd be újra. / Another editor changed this record. Reload it.',code:'revision_conflict'});
    if(e.code==='P0001')return res.status(409).json({error:e.message});
    if(e.code==='42501')return res.status(403).json({error:'Nincs jogosultságod ehhez a művelethez.'});
    if(e.code==='23P01'||e.code==='23505')return res.status(409).json({error:'Ütköző foglalás: az adott barber vagy vendég már foglalt ebben az időszakban.'});
    if(e.code==='23503')return res.status(409).json({error:'A választott szolgáltatás vagy barber már nem elérhető.'});
    if([400,403,404,409,413].includes(e.status))return res.status(e.status).json({error:e.message||'A kérés nem végrehajtható.'});
  }
  console.error('[admin/calendar]',e?.code||e?.message||e);
  return res.status(503).json({error:'Adatbázishiba történt. Próbáld újra.'});
}

async function validateAdminSlot(data,service,manager,excludeId) {
  if(data.status==='cancelled')return;
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.start));
  const end=data.start+service.duration_minutes*60000;
  const range={start:new Date(data.start).toISOString(),end:new Date(end).toISOString()};
  const [hours,off,bookings]=await Promise.all([
    bookingDb('booking_hours',{query:{select:'opens,closes',staff_id:`eq.${data.staffId}`,weekday:`eq.${new Date(day+'T12:00Z').getUTCDay()}`}}),
    readTimeOff(manager,range,data.staffId),
    bookingDb('booking_appointments',{bearer:manager.bearer,adminDevice:manager.adminDevice,query:{select:'id,starts_at,ends_at',staff_id:`eq.${data.staffId}`,status:'neq.cancelled',starts_at:`lt.${range.end}`,ends_at:`gt.${range.start}`,...(excludeId?{id:`neq.${excludeId}`}:{})}}),
  ]);
  if(!hours.some(h=>data.start>=localToUtcMs(day,h.opens.slice(0,5))&&end<=localToUtcMs(day,h.closes.slice(0,5))))error('hours','Az időpont munkaidőn kívülre vagy szünetre esik.',409);
  if(expandTimeOff(off,day,nextDay(day)).some(o=>Date.parse(o.starts_at)<end&&Date.parse(o.ends_at)>data.start))error('leave','A fodrász ebben az időszakban távol van.',409);
  if(bookings.length)error('overlap','Az időpont ütközik egy meglévő foglalással.',409);
}

export async function readStatistics(manager,month=localDay().slice(0,7),requested) {
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))error('month','Hibás hónap.');
  const staff=scopedStaff(manager,requested);
  const [year,number]=month.split('-').map(Number);
  await materializeMonthly(month+'-01',new Date(Date.UTC(year,number,1)).toISOString().slice(0,10),staff);
  return bookingDb('rpc/booking_statistics',{method:'POST',bearer:manager.bearer,adminDevice:manager.adminDevice,body:{p_month:month+'-01',p_staff:staff}});
}
