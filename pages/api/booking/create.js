import {consumeRate,secureHandler} from '../../../lib/server/security';
import { getGuest, getProfile, jsonOnly } from "../../../lib/server/guestAuth";
import { BookingDbError,bookingConfigured,placeBooking } from "../../../lib/server/bookingDb";
export const config={api:{bodyParser:{sizeLimit:"4kb"}}};
async function handler(req,res){
  if(!jsonOnly(req,res,"POST")) return;
  if(!bookingConfigured()) return res.status(503).json({error:"A foglalási adatbázis még nincs konfigurálva."});
  const {serviceId,barberId,date,time}=req.body||{};
  if([serviceId,barberId,date,time].some(s=>typeof s!=="string"||s.length>80)) return res.status(400).json({error:"Érvénytelen foglalási adatok."});
  try {
    const guest=await getGuest(req,res);
    if(!guest) return res.status(401).json({error:"Az időpont véglegesítéséhez újra azonosítanod kell magad."});
    if(!(await consumeRate(req,res,{scope:'booking-create-user',identity:guest.user.id,limit:10,seconds:600})))return;
    const profile=await getProfile(guest);
    if(!profile) return res.status(400).json({error:"Először mentsd a vendégadataidat."});
    const booking=await placeBooking({userId:guest.user.id,guestEmail:guest.user.email,guestName:profile.full_name,guestPhone:profile.phone,serviceId,barberId,date,time,idempotencyKey:req.headers['idempotency-key']});
    const emailSent=null;
    return res.status(201).json({booking,emailSent});
  }catch(error){
    if(error.message==='idempotency_conflict'||['booking_quota','idempotency_conflict'].includes(error.code))return res.status(409).json({error:error.message,code:error.message==='idempotency_conflict'?'idempotency_conflict':error.code});
    if(error instanceof BookingDbError && error.status===409) return res.status(409).json({error:"Ezt az időpontot időközben lefoglalták. Válassz másikat."});
    if(error instanceof BookingDbError && error.status===400) return res.status(400).json({error:"Az időpont vagy szolgáltatás már nem foglalható."});
    console.error("[booking/create]",error.code||error.message);
    return res.status(503).json({error:"Nem sikerült véglegesíteni a foglalást. Próbáld újra."});
  }
}

export default secureHandler(handler,{path:'/api/booking/create'});
