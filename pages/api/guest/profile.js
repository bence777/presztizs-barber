import { getGuest, jsonOnly, safeApiError, upsertProfile } from "../../../lib/server/guestAuth";
export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

export default async function handler(req, res) {
  if (!jsonOnly(req, res, "POST")) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  if (name.length < 2 || name.length > 120 || !/^[+\d()\s-]{7,24}$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
    return res.status(400).json({ error: "Ellenőrizd a nevet és a telefonszámot." });
  }
  try {
    const guest = await getGuest(req, res);
    if (!guest) return res.status(401).json({ error: "Újra azonosítanod kell magad e-mailben." });
    const stored = await upsertProfile(guest, name, phone);
    if (!stored) throw new Error("Profile update returned no record");
    return res.status(200).json({ profile: { name: stored.full_name, phone: stored.phone, email: guest.user.email } });
  } catch (error) { return safeApiError(res, error, "profile"); }
}
