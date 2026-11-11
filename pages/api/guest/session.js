import { getGuest, getProfile, jsonOnly, maskEmail, safeApiError } from "../../../lib/server/guestAuth";

export default async function handler(req, res) {
  if (!jsonOnly(req, res, "GET")) return;
  try {
    const guest = await getGuest(req, res);
    if (!guest) return res.status(200).json({ remembered: false });
    const profile = await getProfile(guest);
    return res.status(200).json({
      remembered: true,
      needsProfile: !profile,
      name: profile?.full_name?.split(/\s+/)[0] || "Vendég",
      maskedEmail: maskEmail(guest.user.email),
    });
  } catch (error) { return safeApiError(res, error, "session"); }
}
