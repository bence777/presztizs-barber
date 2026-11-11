import { bookingConfigured, getBookingConfig } from "../../../lib/server/bookingDb";
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET") return res.status(405).json({error:"Nem támogatott művelet."});
  if(!bookingConfigured()) return res.status(503).json({error:"A foglalórendszer még nincs konfigurálva."});
  try {return res.status(200).json(await getBookingConfig());}
  catch(err) { console.error("[booking/config]", err.code||err.message); return res.status(503).json({error:"Nem sikerült betölteni a szolgáltatásokat."}); }
}
