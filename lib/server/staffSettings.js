import {randomUUID} from 'node:crypto';
import {bookingDb,BookingDbError,invalidateBookingMetadata} from './bookingDb.js';
import {scopedStaff} from './bookingManagement.js';

const fail=message=>{throw new BookingDbError(400,'invalid_settings',message)};
const integer=(value,min,max=2147483647)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const auth=manager=>({bearer:manager.bearer,adminDevice:manager.adminDevice});
const staffFor=(manager,id)=>{const staff=scopedStaff(manager,id);if(!staff)fail('Válassz fodrászt.');return staff};
export const SERVICE_FIELDS='id,staff_id,name,description,duration_minutes,price_huf,active,sort_order,archived_at,counts_as_haircut';
export async function readServices(manager,staffId){
 const staff=staffFor(manager,staffId);
 return bookingDb('booking_services',{...auth(manager),query:{select:SERVICE_FIELDS,staff_id:`eq.${staff}`,archived_at:'is.null',order:'sort_order.asc,name.asc,id.asc'}});
}
export function validateService(payload={}){
 const name=typeof payload.name==='string'?payload.name.trim():'';
 const description=typeof payload.description==='string'?payload.description.trim():'';
 if(name.length<2||name.length>100||description.length>2000)fail('A név 2–100, a leírás legfeljebb 2000 karakter lehet.');
 if(!integer(payload.price_huf,0))fail('Az ár nemnegatív egész forintösszeg legyen.');
 if(!integer(payload.duration_minutes,1))fail('Az időtartam pozitív egész perc legyen.');
 if(!integer(payload.sort_order,0)||typeof payload.active!=='boolean'||typeof payload.counts_as_haircut!=='boolean')fail('Hibás sorrend vagy állapot.');
 return {name,description,price_huf:payload.price_huf,duration_minutes:payload.duration_minutes,sort_order:payload.sort_order,active:payload.active,counts_as_haircut:payload.counts_as_haircut};
}
export async function saveService(manager,payload,{archive=false}={}){
 const staff=staffFor(manager,payload.staffId);
 const id=payload.id;
 if(id!==undefined&&(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)))fail('Hibás szolgáltatásazonosító.');
 if(archive&&!id)fail('Hiányzó szolgáltatás.');
 const data=archive?{active:false,archived_at:new Date().toISOString()}:validateService(payload);
 const rows=await bookingDb('booking_services',{...auth(manager),method:id?'PATCH':'POST',prefer:'return=representation',query:{select:SERVICE_FIELDS,...(id?{id:`eq.${id}`,staff_id:`eq.${staff}`,archived_at:'is.null'}:{})},body:id?data:{...data,id:`sv-${randomUUID()}`,staff_id:staff}});
 if(rows.length!==1)throw new BookingDbError(404,'missing','A szolgáltatás nem található vagy nincs hozzá jogosultságod.');
 invalidateBookingMetadata();return rows[0];
}
export async function readSettings(manager,staffId){
 const staff=staffFor(manager,staffId);
 const [profiles,hours]=await Promise.all([
  bookingDb('booking_staff',{...auth(manager),query:{select:'id,name,image_url,public_phone,booking_step_minutes,default_manual_service_id',id:`eq.${staff}`}}),
  bookingDb('booking_hours',{...auth(manager),query:{select:'weekday,opens,closes',staff_id:`eq.${staff}`,order:'weekday.asc,opens.asc'}})
 ]);
 if(!profiles[0])throw new BookingDbError(404,'missing','A fodrász nem található.');
 return {profile:profiles[0],hours};
}
export async function saveSettings(manager,payload){
 const staff=staffFor(manager,payload.staffId);
 if(payload.hours!==undefined){
  if(!Array.isArray(payload.hours)||payload.hours.length>56)fail('Hibás munkaidő.');
  const hours=payload.hours.map(h=>{
   if(!integer(h.weekday,0,6)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.opens)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.closes)||h.opens>=h.closes)fail('A zárás a nyitás után legyen.');
   return {weekday:h.weekday,opens:h.opens,closes:h.closes};
  });
  for(let i=0;i<hours.length;i++)if(hours.slice(i+1).some(h=>h.weekday===hours[i].weekday&&h.opens<hours[i].closes&&h.closes>hours[i].opens))fail('A munkaidősávok nem fedhetik egymást.');
  await bookingDb('rpc/booking_save_hours',{...auth(manager),method:'POST',body:{p_staff:staff,p_hours:hours}});
 }else{
  const name=typeof payload.name==='string'?payload.name.trim():'';
  const public_phone=typeof payload.public_phone==='string'?payload.public_phone.trim():'';
  const image_url=typeof payload.image_url==='string'?payload.image_url.trim():'';
  if(name.length<2||name.length>100)fail('A megjelenített név 2–100 karakter legyen.');
  if(public_phone&&!/^\+?[\d\s()/-]{7,24}$/.test(public_phone))fail('Hibás nyilvános telefonszám.');
  if(image_url&&!(image_url.startsWith('/images/')&&!image_url.includes('..')||/^https:\/\/[^\s]+$/i.test(image_url)))fail('A képhez HTTPS hivatkozást adj meg.');
  if(image_url.length>2000||!integer(payload.booking_step_minutes,1,1440))fail('A kezdési lépésköz 1–1440 egész perc legyen.');
  const defaultId=payload.default_manual_service_id||null;
  if(defaultId&&!(await readServices(manager,staff)).some(s=>s.id===defaultId&&s.active))fail('Válassz saját, aktív alapértelmezett szolgáltatást.');
  const rows=await bookingDb('booking_staff',{...auth(manager),method:'PATCH',prefer:'return=representation',query:{id:`eq.${staff}`,select:'id'},body:{name,public_phone:public_phone||null,image_url:image_url||null,booking_step_minutes:payload.booking_step_minutes,default_manual_service_id:defaultId}});
  if(rows.length!==1)throw new BookingDbError(404,'missing','A fodrász nem található.');
 }
 invalidateBookingMetadata();return readSettings(manager,staff);
}
