import { authApi, getProfile, jsonOnly, safeApiError, setGuestCookies } from "../../../lib/server/guestAuth";
import { registerTrustedDevice, setDeviceCookie } from "../../../lib/server/trustedDevices";
export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

export default async function handler(req, res) {
  if (!jsonOnly(req, res, "POST")) return;
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const remember = req.body?.remember !== false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6,10}$/.test(code)) {
    return res.status(400).json({ error: "Érvénytelen e-mail-cím vagy kód." });
  }
  try {
    const result = await authApi("verify", {
      method: "POST", body: { email, token: code, type: "email" },
    });
    if (!result.ok || !result.data?.access_token || !result.data?.refresh_token || !result.data?.user?.id) {
      return res.status(401).json({ error: "Hibás vagy lejárt ellenőrző kód." });
    }
    const guest = { user: result.data.user, token: result.data.access_token };
    const profile = await getProfile(guest);
    const expiry = Date.now() + (remember ? 60 * 24 : 12) * 60 * 60 * 1000;
    const deviceToken = await registerTrustedDevice(req, { userId: guest.user.id, scope: "guest", expiresAt: expiry });
    setGuestCookies(res, result.data, guest.user.id, { remember });
    setDeviceCookie(res, "guest", deviceToken, expiry, remember);
    return res.status(200).json({
      ok: true, needsProfile: !profile, email: guest.user.email,
      profile: profile ? { name: profile.full_name, phone: profile.phone, email: guest.user.email } : null,
    });
  } catch (error) {
    if (error?.status === 409) return res.status(409).json({ error: error.message });
    return safeApiError(res, error, "verify-code");
  }
}
