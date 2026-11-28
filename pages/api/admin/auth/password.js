import {verifiedClaims} from '../../../../lib/server/security';
import {secureHandler} from '../../../../lib/server/security';
import {jsonOnly} from '../../../../lib/server/guestAuth';
import {staffPasswordLogin} from '../../../../lib/server/staffAccounts';
import {setAdminCookies} from '../../../../lib/server/adminAuth';
import {registerTrustedDevice,setDeviceCookie} from '../../../../lib/server/trustedDevices';
export const config={api:{bodyParser:{sizeLimit:'2kb'}}};
async function handler(req,res){
 if(!jsonOnly(req,res,'POST'))return;
 try {
  const {session,manager}=await staffPasswordLogin(req.body?.email??req.body?.loginName,req.body?.password);
  const remember=req.body?.remember===true,expiry=Date.now()+(remember?7*24:12)*3600000;
  const credential=await registerTrustedDevice(req,{userId:session.user.id,scope:'admin',expiresAt:expiry,sessionId:verifiedClaims(session.access_token).session_id});
  setAdminCookies(res,session,session.user.id,undefined,remember);setDeviceCookie(res,'admin',credential,expiry,remember);
  return res.status(200).json({ok:true,manager:{role:manager.role,staff_id:manager.staff_id}});
 }catch(e){
  if([400,401,403,429].includes(e.status))return res.status(e.status).json({error:e.message});
  console.error('[admin/password]',e.code||'unavailable');return res.status(503).json({error:'A belépés most nem elérhető. Próbáld újra.'});
 }
}

export default secureHandler(handler,{path:'/api/admin/auth/password'});
