import { bookingConfigured, getBookingConfig } from "../../../lib/server/bookingDb";
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET") return res.status(405).json({error:"Nem támogatott művelet."});
  if(!bookingConfigured()) return res.status(503).json({error:"A foglalórendszer még nincs konfigurálva."});
  try {
    const config = await getBookingConfig();
    // Vendégazonosító nélkül is publikus törzsadatok; biztonságosan cache-elhetők.
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=45, stale-while-revalidate=15");
    return res.status(200).json(config);
  }
  catch(err) { console.error("[booking/config]", err.code||err.message); return res.status(503).json({error:"Nem sikerült betölteni a szolgáltatásokat."}); }
}
