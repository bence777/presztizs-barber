import {secureHandler,consumeRate,freshMfa} from '../../../../lib/server/security';
import {jsonOnly,authApi} from '../../../../lib/server/guestAuth';
import {getAdmin,setAdminCookies} from '../../../../lib/server/adminAuth';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return res.status(405).end();
 if(!jsonOnly(req,res,req.method))return;
 const admin=await getAdmin(req,res);if(!admin)return res.status(401).json({error:'Lépj be újra. / Sign in again.'});
 if(req.method==='GET')return res.json({factors:(admin.user.factors||[]).filter(f=>f.factor_type==='totp').map(f=>({id:f.id,status:f.status,friendly_name:f.friendly_name})),aal:admin.claims.aal,required:admin.manager.role==='owner'||admin.settings.require_staff_mfa});
 if(!(await consumeRate(req,res,{scope:'mfa-user',identity:admin.user.id,limit:15,seconds:600})))return;
 const {operation,factorId,code}=req.body||{};
 let result;
 if(operation==='enroll'){
  if(admin.user.factors?.some(f=>f.status==='verified')&&!freshMfa(admin.claims))return res.status(403).json({error:'Előbb adj meg friss hitelesítő kódot. / Verify a fresh code first.'});
  const pending=admin.user.factors?.filter(f=>f.status==='unverified'&&f.factor_type==='totp')||[];
  for(const f of pending)await authApi(`factors/${f.id}`,{method:'DELETE',bearer:admin.token});
  result=await authApi('factors',{method:'POST',bearer:admin.token,body:{factor_type:'totp',friendly_name:`DEMETERS ${new Date().toISOString().slice(0,19)}`,issuer:'DEMETERS'}});
 }else if(operation==='verify'&&UUID.test(factorId||'')&&/^\d{6}$/.test(code||'')){
  if(!admin.user.factors?.some(f=>f.id===factorId))return res.status(400).json({error:'Hibás faktor. / Invalid factor.'});
  const challenge=await authApi(`factors/${factorId}/challenge`,{method:'POST',bearer:admin.token,body:{}});
  if(!challenge.ok)return res.status(400).json({error:'Az ellenőrzés nem indítható. / Cannot start verification.'});
  result=await authApi(`factors/${factorId}/verify`,{method:'POST',bearer:admin.token,body:{challenge_id:challenge.data.id,code}});
  if(result.ok&&result.data?.access_token&&result.data?.refresh_token)setAdminCookies(res,result.data,admin.user.id,req.cookies.pb_admin_until);
 }else if(operation==='unenroll'&&UUID.test(factorId||'')){
  if(!freshMfa(admin.claims))return res.status(403).json({error:'Friss hitelesítő kód szükséges. / Verify a fresh code.'});
  const factors=admin.user.factors?.filter(f=>f.status==='verified')||[];
  if(factors.length<2)return res.status(409).json({error:'Előbb állíts be egy második hitelesítő eszközt. / Add a backup authenticator first.'});
  result=await authApi(`factors/${factorId}`,{method:'DELETE',bearer:admin.token});
 }else return res.status(400).json({error:'Hibás művelet. / Invalid operation.'});
 if(!result.ok)return res.status(400).json({error:'Sikertelen ellenőrzés. Próbáld újra. / Verification failed. Try again.'});
 return res.json(operation==='enroll'?{factor:result.data}:{ok:true});
}
export default secureHandler(handler,{path:'/api/admin/auth/mfa'});
