import { getGuest, getProfile, jsonOnly, safeApiError } from "../../../lib/server/guestAuth";

export default async function handler(req, res) {
  if (!jsonOnly(req, res, "GET")) return;
  try {
    const guest = await getGuest(req, res);
    if (!guest) return res.status(401).json({ error: "Lejárt a bejelentkezés. Kérj új e-mail-kódot." });
    const profile = await getProfile(guest);
    return res.status(200).json({
      needsProfile: !profile,
      email: guest.user.email,
      profile: profile ? { name: profile.full_name, phone: profile.phone, email: guest.user.email } : null,
    });
  } catch (error) { return safeApiError(res, error, "me"); }
}
