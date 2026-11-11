import { authApi, clearGuestCookies, getGuest, jsonOnly, safeApiError } from './guestAuth.js';
import { clearAdminCookies, getAdmin } from './adminAuth.js';
import { managerByEmail } from './bookingManagement.js';
import { listTrustedDevices, removeTrustedDevice, renameTrustedDevice } from './trustedDevices.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deviceApiHandler(req, res, scope) {
  if (!['GET','PATCH','DELETE'].includes(req.method)) {
    res.setHeader('Allow','GET, PATCH, DELETE');
    return res.status(405).json({error:'Nem támogatott művelet.'});
  }
  if (!jsonOnly(req,res,req.method)) return;
  try {
    const auth = scope === 'admin' ? await getAdmin(req,res) : await getGuest(req,res);
    if (!auth) return res.status(401).json({error:'A munkamenet lejárt. Jelentkezz be újra.'});
    if (scope === 'admin' && !(await managerByEmail(auth.user.email))) {
      return res.status(403).json({error:'A kezelői jogosultság megszűnt.'});
    }
    if (req.method === 'GET') {
      const devices = await listTrustedDevices(req,{userId:auth.user.id,scope});
      return res.status(200).json({devices});
    }
    const id = req.body?.id;
    if (typeof id !== 'string' || !UUID.test(id)) {
      return res.status(400).json({error:'Érvénytelen eszközazonosító.'});
    }
    if (req.method === 'PATCH') {
      const name = req.body?.name;
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
        return res.status(400).json({error:'Az eszköz neve 2–60 karakter lehet.'});
      }
      const renamed = await renameTrustedDevice({userId:auth.user.id,scope,id,name});
      return renamed ? res.status(200).json({ok:true}) : res.status(404).json({error:'Az eszköz nem található.'});
    }
    const devices = await listTrustedDevices(req,{userId:auth.user.id,scope});
    const target = devices.find(device => device.id === id);
    if (!target) return res.status(404).json({error:'Az eszköz már nincs a listában.'});
    const deleted = await removeTrustedDevice({userId:auth.user.id,scope,id});
    if (!deleted) return res.status(409).json({error:'Az eszköz időközben megváltozott.'});
    if (target.current) {
      // Erase app credentials immediately. Remote access is blocked by the DB row revocation.
      if (scope === 'admin') clearAdminCookies(res);
      else clearGuestCookies(res);
      // Best effort: Supabase local logout without logging out other devices.
      try { await authApi('logout?scope=local',{method:'POST',bearer:auth.token,body:{}}); }
      catch (error) { console.warn('[device-api] remote logout',error?.message); }
    }
    return res.status(200).json({ok:true,current:target.current});
  } catch(error) {
    return safeApiError(res,error,`${scope}-devices`);
  }
}
