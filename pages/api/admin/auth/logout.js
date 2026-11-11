import { authApi, jsonOnly } from '../../../../lib/server/guestAuth';
import { clearAdminCookies, getAdmin } from '../../../../lib/server/adminAuth';
import { removeCurrentTrustedDevice } from '../../../../lib/server/trustedDevices';
export default async function handler(req, res) {
  if (!jsonOnly(req, res, 'POST')) return;
  try {
    const admin = await getAdmin(req, res);
    if (admin) await removeCurrentTrustedDevice(req, {userId:admin.user.id,scope:'admin'});
  } catch(error) {
    console.error('[admin/auth] revoke device',error?.code||error?.message);
    return res.status(503).json({error:'Nem sikerült visszavonni az eszköz hozzáférését. Próbáld újra.'});
  }
  const token = req.cookies?.pb_admin_access;
  // Log out ONLY the admin session, not pb_access / pb_refresh used by guests.
  clearAdminCookies(res);
  try {
    if (token) await authApi('logout?scope=local', {method:'POST',bearer:token,body:{}});
  } catch(error) {
    console.warn('[admin/auth] logout',error.message);
  }
  return res.status(200).json({ok:true});
}
