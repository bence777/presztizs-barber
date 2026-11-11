import { jsonOnly } from '../../../../lib/server/guestAuth';
import { managerFor } from '../../../../lib/server/bookingManagement';
export default async function handler(req, res) {
  if (!jsonOnly(req, res, 'GET')) return;
  try {
    const session = await managerFor(req, res);
    // No admin session => show the admin login. Never reuse a guest session here.
    if (!session.admin) return res.status(200).json({authenticated:false});
    if (!session.manager) return res.status(403).json({error:'Ehhez a bejelentkezett e-mail-címhez nincs kezelői jogosultság.',email:session.admin.user.email});
    return res.status(200).json({authenticated:true,manager:{email:session.manager.email,role:session.manager.role,staff_id:session.manager.staff_id}});
  } catch(error) {
    console.error('[admin/auth] session',error.message);
    return res.status(502).json({error:'Nem sikerült ellenőrizni a kezelői belépést.'});
  }
}
