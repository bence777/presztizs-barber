import { bookingConfigured, BookingDbError, getMonthAvailability } from "../../../lib/server/bookingDb";
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET") return res.status(405).json({error:"Nem támogatott művelet."});
  if(!bookingConfigured()) return res.status(503).json({error:"A foglalórendszer még nincs konfigurálva."});
  const {service,barber,month}=req.query;
  if([service,barber,month].some(x=>typeof x!=="string")) return res.status(400).json({error:"Érvénytelen paraméterek."});
  try {
    const {days,hasWorkingHours}=await getMonthAvailability({serviceId:service,barberId:barber,month});
    // Csak anonim szabad idősávokat tartalmaz: rövid CDN cache.
    // A tényleges foglalást a szerver mindig friss DB-adatokkal ellenőrzi.
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=8, stale-while-revalidate=5");
    return res.status(200).json({days,hasWorkingHours});
  } catch(error) {
    if(error instanceof BookingDbError && error.status===400) return res.status(400).json({error:"Érvénytelen dátum vagy szolgáltatás."});
    console.error("[booking/availability]",error.code||error.message);
    return res.status(503).json({error:"A szabad időpontok lekérése nem sikerült."});
  }
}
