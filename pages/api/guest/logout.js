import { authApi, clearGuestCookies, jsonOnly } from "../../../lib/server/guestAuth";

export default async function handler(req, res) {
  if (!jsonOnly(req, res, "POST")) return;
  const access = req.cookies?.pb_access;
  // A logout cookie-törlés akkor is megtörténik, ha a távoli kijelentkeztetés hibázik.
  try {
    if (access) await authApi("logout?scope=local", { method: "POST", bearer: access, body: {} });
  } catch { /* local logout still works */ }
  clearGuestCookies(res);
  return res.status(200).json({ ok: true });
}
