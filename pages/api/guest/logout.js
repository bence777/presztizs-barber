import { authApi, clearGuestCookies, getGuest, jsonOnly } from "../../../lib/server/guestAuth";
import { removeCurrentTrustedDevice } from "../../../lib/server/trustedDevices";

export default async function handler(req, res) {
  if (!jsonOnly(req, res, "POST")) return;
  // Revoke the server-side credential BEFORE clearing local cookies.
  try {
    const guest = await getGuest(req, res);
    if (guest) await removeCurrentTrustedDevice(req, {userId:guest.user.id,scope:"guest"});
  } catch (error) {
    console.error("[guest-auth] revoke device", error?.code || error?.message);
    return res.status(503).json({error:"Nem sikerült visszavonni az eszköz hozzáférését. Próbáld újra."});
  }
  const access = req.cookies?.pb_access;
  // A logout cookie-törlés akkor is megtörténik, ha a távoli kijelentkeztetés hibázik.
  try {
    if (access) await authApi("logout?scope=local", { method: "POST", bearer: access, body: {} });
  } catch { /* local logout still works */ }
  clearGuestCookies(res);
  return res.status(200).json({ ok: true });
}
