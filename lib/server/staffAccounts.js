// Server-only account provisioning. Existing owner accounts cannot be changed here.
import {bookingDb,BookingDbError} from './bookingDb.js';
import {assertManager,managerByEmail} from './bookingManagement.js';
import {authApi} from './guestAuth.js';
const DOMAIN='staff.demeters.invalid';
const USERNAME=/^[a-z0-9][a-z0-9._-]{2,39}$/;
const FIELDS='email,role,staff_id,active';
function fail(status,message){throw new BookingDbError(status,'staff_account',message)}
export function requireOwner(manager){assertManager(manager);if(manager.role!=='owner')fail(403,'Fodrászfiókokat csak a főadmin kezelhet.');}
export function staffLoginEmail(value){const login=typeof value==='string'?value.trim().toLowerCase():'';if(!USERNAME.test(login))fail(400,'A felhasználónév 3–40 kisbetűt, számot, pontot, kötőjelet vagy aláhúzást tartalmazhat.');return `${login}@${DOMAIN}`;}
export function publicAccount(row){return {loginName:row.email.endsWith('@'+DOMAIN)?row.email.slice(0,-DOMAIN.length-1):null,email:row.email.endsWith('@'+DOMAIN)?null:row.email,staffId:row.staff_id,active:row.active};}
async function authAdmin(path,{method='GET',body}={}){
 const response=await fetch(new URL('/auth/v1/admin/'+path,process.env.SUPABASE_URL),{method,headers:{apikey:process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new BookingDbError(response.status===422?409:503,'auth_account',response.status===422?'A felhasználónév már foglalt, vagy a jelszó nem elfogadható.':'A fiók hitelesítési beállításait most nem sikerült menteni.');
 return data;
}
async function findAuthUser(email){
 for(let page=1;page<=100;page++){
  const result=await authAdmin(`users?page=${page}&per_page=100`),users=result?.users||[];
  const user=users.find(u=>u.email?.toLowerCase()===email);if(user)return user;
  if(users.length<100)return null;
 }
 fail(503,'A fiókkeresés most nem fejezhető be.');
}
export async function readStaffAccounts(manager){
 requireOwner(manager);
 const [staff,rows]=await Promise.all([
  bookingDb('booking_staff',{query:{select:'id,name,active',order:'sort_order.asc,name.asc'}}),
  bookingDb('booking_managers',{query:{select:FIELDS,role:'eq.barber',order:'staff_id.asc,email.asc'}}),
 ]);
 return {staff,accounts:rows.map(publicAccount)};
}
export async function saveStaffAccount(payload,manager){
 requireOwner(manager);
 const email=staffLoginEmail(payload.loginName),name=typeof payload.name==='string'?payload.name.trim():'';
 if(!/^[a-z0-9][a-z0-9-]{1,60}$/.test(payload.staffId||'')||name.length<2||name.length>100||typeof payload.active!=='boolean')fail(400,'Adj meg fodrászt, nevet és hozzáférést.');
 const rows=await bookingDb('booking_managers',{query:{select:FIELDS,email:`eq.${email}`,limit:'1'}});
 const existing=rows[0];
 if(existing&&existing.role!=='barber')fail(409,'A meglévő főadminfiók nem módosítható fodrászfiókká.');
 if(existing&&existing.staff_id!==payload.staffId)fail(409,'Ez a felhasználónév már másik fodrászhoz tartozik.');
 const staff=await bookingDb('booking_staff',{query:{select:'id,active',id:`eq.${payload.staffId}`,limit:'1'}});
 if(!staff[0])fail(404,'A fodrász nem található.');
 if(payload.active&&!staff[0].active)fail(409,'Inaktív fodrászhoz nem aktiválható belépés.');
 const password=typeof payload.password==='string'?payload.password:'';
 if((!existing||password)&& (password.length<12||password.length>128))fail(400,'Legalább 12, legfeljebb 128 karakteres jelszót adj meg.');
 // Reserve a new login disabled. A failed Auth request never leaves active privileges.
 if(!existing)await bookingDb('booking_managers',{method:'POST',body:{email,role:'barber',staff_id:payload.staffId,active:false}});
 let user=null;
 if(password){
  user=await findAuthUser(email);
  if(user)await authAdmin(`users/${user.id}`,{method:'PUT',body:{password,email_confirm:true}});
  else {const created=await authAdmin('users',{method:'POST',body:{email,password,email_confirm:true}});user=created?.user||created;}
  if(!user?.id)fail(503,'A hitelesítési fiók még nem készült el.');
  // A password reset invalidates existing admin devices immediately, including RLS.
  await bookingDb('trusted_devices',{method:'DELETE',query:{user_id:`eq.${user.id}`,scope:'eq.admin'}});
 }
 if(payload.active&&!password&&!await findAuthUser(email))fail(409,'A belépés aktiválásához előbb állíts be jelszót.');
 await bookingDb('booking_staff',{method:'PATCH',query:{id:`eq.${payload.staffId}`},body:{name}});
 const saved=await bookingDb('booking_managers',{method:'PATCH',query:{email:`eq.${email}`,role:'eq.barber',staff_id:`eq.${payload.staffId}`,select:FIELDS},body:{active:payload.active},prefer:'return=representation'});
 if(saved.length!==1)fail(409,'A fiók időközben megváltozott.');
 return publicAccount(saved[0]);
}
export async function setEmailStaffAccess(payload,manager){
 requireOwner(manager);
 // Keep legacy real-email/OTP staff accounts manageable without migrating their identity.
 if(typeof payload.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)||typeof payload.active!=='boolean')fail(400,'Hibás fiókadat.');
 const saved=await bookingDb('booking_managers',{method:'PATCH',query:{email:`eq.${payload.email.toLowerCase()}`,role:'eq.barber',select:FIELDS},body:{active:payload.active},prefer:'return=representation'});
 if(saved.length!==1)fail(404,'A fodrászfiók nem található.');return publicAccount(saved[0]);
}
export async function staffPasswordLogin(loginName,password){
 let email;try{email=staffLoginEmail(loginName)}catch{fail(401,'Hibás felhasználónév vagy jelszó.');}
 if(typeof password!=='string'||!password||password.length>128)fail(401,'Hibás felhasználónév vagy jelszó.');
 const manager=await managerByEmail(email);
 if(manager?.role!=='barber')fail(401,'Hibás felhasználónév vagy jelszó.');
 const result=await authApi('token?grant_type=password',{method:'POST',body:{email,password}});
 if(result.status===429)fail(429,'Túl sok belépési kísérlet. Próbáld újra később.');
 const session=result.data;
 if(!result.ok||!session?.user?.id||session.user.email?.toLowerCase()!==email||!session.access_token||!session.refresh_token)fail(401,'Hibás felhasználónév vagy jelszó.');
 return {session,manager};
}
