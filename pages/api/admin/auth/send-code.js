import {bookingDb} from '../../../../lib/server/bookingDb';
import {requestContext} from '../../../../lib/server/http';
import {secureHandler} from '../../../../lib/server/security';
import { jsonOnly } from '../../../../lib/server/guestAuth';
import { normalizedAdminEmail } from '../../../../lib/server/adminAuth';
export const config = { api: { bodyParser: { sizeLimit:'4kb' } } };

async function handler(req, res) {
  if (!jsonOnly(req, res, 'POST')) return;
  const email = normalizedAdminEmail(req.body?.email);
  if (!email) return res.status(400).json({error:'Adj meg egy érvényes kezelői e-mail-címet.'});
  try {
    await bookingDb('rpc/booking_queue_admin_otp',{method:'POST',body:{p_email:email,p_request:requestContext.getStore().id}});
    return res.status(200).json({ok:true});
  } catch(error) {
    console.error('[admin/auth] send-code',error.message);
    return res.status(502).json({error:'Átmenetileg nem érhető el a bejelentkezés.'});
  }
}

export default secureHandler(handler,{path:'/api/admin/auth/send-code'});
