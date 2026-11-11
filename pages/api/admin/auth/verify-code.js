import { authApi, jsonOnly } from '../../../../lib/server/guestAuth';
import { normalizedAdminEmail, setAdminCookies } from '../../../../lib/server/adminAuth';
import { managerByEmail } from '../../../../lib/server/bookingManagement';
import { registerTrustedDevice, setDeviceCookie } from '../../../../lib/server/trustedDevices';
export const config = { api: { bodyParser: { sizeLimit:'4kb' } } };

export default async function handler(req, res) {
  if (!jsonOnly(req, res, 'POST')) return;
  const email = normalizedAdminEmail(req.body?.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const remember = req.body?.remember === true;
  if (!email || !/^\d{6,10}$/.test(code)) return res.status(400).json({error:'Érvénytelen e-mail-cím vagy ellenőrző kód.'});
  try {
    const verified = await authApi('verify', {method:'POST',body:{email,token:code,type:'email'}});
    const session = verified.data;
    if (!verified.ok || !session?.access_token || !session?.refresh_token || !session?.user?.id) {
      return res.status(401).json({error:'Hibás vagy lejárt ellenőrző kód.'});
    }
    // Confirm verified identity, not just the untrusted e-mail supplied in the POST body.
    if (normalizedAdminEmail(session.user.email) !== email) {
      return res.status(403).json({error:'Az azonosított e-mail-cím nem egyezik.'});
    }
    const manager = await managerByEmail(session.user.email);
    if (!manager) return res.status(403).json({error:'Ehhez az e-mail-címhez nem tartozik aktív kezelői jogosultság.'});
    const expiry = Date.now() + (remember ? 7 * 24 : 12) * 60 * 60 * 1000;
    const deviceToken = await registerTrustedDevice(req, {userId:session.user.id,scope:"admin",expiresAt:expiry});
    setAdminCookies(res, session, session.user.id, undefined, remember);
    setDeviceCookie(res, "admin", deviceToken, expiry, remember);
    return res.status(200).json({ok:true,manager:{email:manager.email,role:manager.role,staff_id:manager.staff_id}});
  } catch(error) {
    if(error?.status===409)return res.status(409).json({error:error.message});
    console.error('[admin/auth] verify-code',error.message);
    return res.status(502).json({error:'Átmenetileg nem érhető el a kezelői bejelentkezés.'});
  }
}
