import { authApi, jsonOnly } from '../../../../lib/server/guestAuth';
import { normalizedAdminEmail } from '../../../../lib/server/adminAuth';
import { managerByEmail } from '../../../../lib/server/bookingManagement';
export const config = { api: { bodyParser: { sizeLimit:'4kb' } } };

export default async function handler(req, res) {
  if (!jsonOnly(req, res, 'POST')) return;
  const email = normalizedAdminEmail(req.body?.email);
  if (!email) return res.status(400).json({error:'Adj meg egy érvényes kezelői e-mail-címet.'});
  try {
    const manager = await managerByEmail(email);
    if (!manager) {
      // Do not reveal which e-mail addresses belong to salon managers.
      return res.status(200).json({ok:true});
    }
    // create_user:true is restricted to pre-authorized managers; it allows a new barber
    // to receive an OTP without creating a GUEST PROFILE or signing up as a customer.
    const sent = await authApi('otp', {method:'POST',body:{email,create_user:true}});
    if (sent.status === 429) return res.status(429).json({error:'Túl sok kérés. Próbáld újra egy perc múlva.'});
    if (!sent.ok) {
      console.warn('[admin/auth] OTP dispatch error', sent.status);
      return res.status(503).json({error:'Nem sikerült elküldeni a belépési kódot.'});
    }
    return res.status(200).json({ok:true});
  } catch(error) {
    console.error('[admin/auth] send-code',error.message);
    return res.status(502).json({error:'Átmenetileg nem érhető el a bejelentkezés.'});
  }
}
