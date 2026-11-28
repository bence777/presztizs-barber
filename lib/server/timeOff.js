import {revisionFilter,revisionConflict} from './revision.js';
import {bookingDb,bookingDbRows, BookingDbError, localToUtcMs, localDay} from './bookingDb.js';
import {scopedStaff} from './bookingManagement.js';

export const offsetDay=(day,n)=>{const [y,m,d]=day.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)};
export function validDay(day) {return typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && localToUtcMs(day,'00:00')!==null}
const fail=(message,status=400)=>{throw new BookingDbError(status,'time_off',message)};
const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;

// Legacy rows remain continuous intervals. New partial absences repeat each day.
export function expandTimeOff(rows,from,to) {
  return rows.flatMap(row=>{
    if(!row.daily_start || !row.daily_end)return [row];
    const result=[];
    const first=localDay(new Date(row.starts_at).getTime()),last=localDay(new Date(row.ends_at).getTime());
    for(let day=first>from?first:from;day<=last&&day<to;day=offsetDay(day,1)) {
      const start=localToUtcMs(day,row.daily_start.slice(0,5)),end=localToUtcMs(day,row.daily_end.slice(0,5));
      if(start!==null&&end!==null)result.push({...row,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()});
    }
    return result;
  });
}
export async function readTimeOff(manager,range,staffId) {
  const staff=scopedStaff(manager,staffId);
  return bookingDbRows('booking_time_off',{bearer:manager.bearer,adminDevice:manager.adminDevice,maxRows:5000,query:{select:'revision,id,staff_id,starts_at,ends_at,reason,all_day,daily_start,daily_end,kind'+(staff?'':',booking_staff!inner(active)'),...(!staff?{'booking_staff.active':'eq.true'}:{}),starts_at:`lt.${range.end}`,ends_at:`gt.${range.start}`,...(staff?{staff_id:`eq.${staff}`}:{ }),order:'starts_at.asc,id.asc'}});
}
export function timeOffPayload(payload,manager) {
  const staff=scopedStaff(manager,payload.staffId);
  if(!staff)fail('Válassz fodrászt.');
  const {startDate,endDate,allDay,startTime,endTime}=payload;
  if(!validDay(startDate)||!validDay(endDate)||endDate<startDate||endDate>offsetDay(startDate,365))fail('Adj meg érvényes időszakot (legfeljebb egy év).');
  if(typeof allDay!=='boolean')fail('Válaszd ki a távollét típusát.');
  if(!allDay&&(!timePattern.test(startTime||'')||!timePattern.test(endTime||'')||endTime<=startTime))fail('A befejezés legyen később a kezdésnél.');
  const start=localToUtcMs(startDate,allDay?'00:00':startTime),end=localToUtcMs(allDay?offsetDay(endDate,1):endDate,allDay?'00:00':endTime);
  if(start===null||end===null)fail('Nem létező helyi időpont az óraátállítás miatt.');
  return {staff_id:staff,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),all_day:allDay,daily_start:allDay?null:startTime,daily_end:allDay?null:endTime,kind:payload.kind==='break'?'break':'leave',reason:typeof payload.reason==='string'?payload.reason.trim().slice(0,500):null};
}
export async function mutateTimeOff(method,payload,manager) {
  scopedStaff(manager);
  const query={select:'*'};
  if(method!=='POST') {
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.id||''))fail('Hibás távollétazonosító.');
    query.id=`eq.${payload.id}`;query.revision=revisionFilter(payload.revision);
    if(manager.role==='barber')query.staff_id=`eq.${manager.staff_id}`;
  }
  const body=method==='DELETE'?undefined:timeOffPayload(payload,manager);
  const rows=await bookingDb('booking_time_off',{method,bearer:manager.bearer,adminDevice:manager.adminDevice,query,body,prefer:'return=representation'});
  if(rows.length!==1)revisionConflict();
  return rows[0];
}
