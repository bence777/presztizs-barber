// SERVER ONLY: Auth users and salon permissions are provisioned together.
import {bookingDb,BookingDbError} from './bookingDb.js';
import {assertManager,managerByEmail} from './bookingManagement.js';
import {authApi} from './guestAuth.js';
import {normalizedAdminEmail} from './adminAuth.js';
import {isPlaceholderEmail,placeholderStaffEmail} from './staffPlaceholders.js';
const LEGACY_DOMAIN='staff.demeters.invalid';
const STAFF_ID=/^[a-z0-9][a-z0-9-]{1,60}$/;
const NEW_STAFF_ID=/^barber-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS='email,role,staff_id,active';
function fail(status,message){throw new BookingDbError(status,'staff_account',message)}
export function requireOwner(manager){assertManager(manager);if(manager.role!=='owner')fail(403,'Fodrászfiókokat csak a főadmin kezelhet.');}
export function staffAccountEmail(value){
 const email=normalizedAdminEmail(value);
 if(!email||/\.(invalid|example|test|localhost)$/i.test(email))fail(400,'A fodrász saját, valódi e-mail-címét add meg.');
 return email;
}
// Existing username accounts continue to work; no new synthetic addresses are created.
export function staffLoginEmail(value){
 if(typeof value==='string'&&value.includes('@')){const email=normalizedAdminEmail(value);if(email)return email;}
 const login=typeof value==='string'?value.trim().toLowerCase():'';
 if(/^[a-z0-9][a-z0-9._-]{2,39}$/.test(login))return `${login}@${LEGACY_DOMAIN}`;
 fail(400,'Érvényes e-mail-címet adj meg.');
}
function publicAccount(row,user){return {email:row.email,loginName:row.email.endsWith('@'+LEGACY_DOMAIN)?row.email.slice(0,-LEGACY_DOMAIN.length-1):null,staffId:row.staff_id,active:row.active,authUserId:user?.id||null,...(isPlaceholderEmail(row.email)?{isPlaceholder:true}:{})};}
async function authAdmin(path,{method='GET',body}={}){
 const response=await fetch(new URL('/auth/v1/admin/'+path,process.env.SUPABASE_URL),{method,headers:{apikey:process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new BookingDbError(response.status===422?409:503,'auth_account',response.status===422?'Az e-mail-cím vagy a kezdő jelszó nem elfogadható. Ellenőrizd az adatokat.':'A Supabase Auth-fiókot most nem sikerült ellenőrizni vagy menteni.');
 return data;
}
async function findAuthUsers(emails){
 const remaining=new Set(emails),found=new Map();
 if(!remaining.size)return found;
 for(let page=1;page<=100;page++){
  const result=await authAdmin(`users?page=${page}&per_page=100`),users=result?.users;
  if(!Array.isArray(users))fail(503,'A hitelesítési fiókok válasza nem ellenőrizhető.');
  for(const user of users){const email=user.email?.toLowerCase();if(remaining.has(email)){found.set(email,user);remaining.delete(email);}}
  if(!remaining.size||users.length<100)return found;
 }
 fail(503,'A fiókkeresés most nem fejezhető be.');
}
async function findAuthUser(email){return (await findAuthUsers([email])).get(email)||null;}
export async function readStaffAccounts(manager){
 requireOwner(manager);
 const [staff,rows]=await Promise.all([
  bookingDb('booking_staff',{query:{select:'id,name,active',order:'sort_order.asc,name.asc'}}),
  bookingDb('booking_managers',{query:{select:FIELDS,role:'eq.barber',order:'staff_id.asc,email.asc'}}),
 ]);
 // Keep unfinished account setup available, while retired legacy profiles stay hidden.
 const visibleStaff=staff.filter(s=>s.active||NEW_STAFF_ID.test(s.id));
 const visibleIds=new Set(visibleStaff.map(s=>s.id));
 const visibleAccounts=rows.filter(row=>visibleIds.has(row.staff_id));
 const users=await findAuthUsers(visibleAccounts.map(row=>row.email));
 return {staff:visibleStaff.map(s=>({...s,pendingSetup:!s.active&&NEW_STAFF_ID.test(s.id)})),accounts:visibleAccounts.map(row=>publicAccount(row,users.get(row.email)))};
}
export async function saveStaffAccount(payload,manager){
 requireOwner(manager);
 if(payload.previousEmail)return replacePlaceholderAccount(payload,manager);
 const email=staffAccountEmail(payload.email),name=typeof payload.name==='string'?payload.name.trim():'';
 const newStaff=payload.createStaff===true;
 if(!STAFF_ID.test(payload.staffId||'')||(newStaff&&!NEW_STAFF_ID.test(payload.staffId))||name.length<2||name.length>100||typeof payload.active!=='boolean')fail(400,'Adj meg fodrászt, nevet, saját e-mail-címet és hozzáférést.');
 const password=typeof payload.password==='string'?payload.password:'';
 if(password&&(password.length<12||password.length>128))fail(400,'A kezdő jelszó legalább 12, legfeljebb 128 karakter legyen.');
 const rows=await bookingDb('booking_managers',{query:{select:FIELDS,email:`eq.${email}`,limit:'1'}});
 const existing=rows[0];
 if(existing?.role&&existing.role!=='barber')fail(409,'A meglévő főadminfiók nem módosítható fodrászfiókká.');
 if(existing&&existing.staff_id!==payload.staffId)fail(409,'Ehhez az e-mail-címhez már másik fodrász tartozik.');
 let staff=(await bookingDb('booking_staff',{query:{select:'id,active',id:`eq.${payload.staffId}`,limit:'1'}}))[0];
 if(newStaff&&staff?.active&&!existing)fail(409,'Ez a fodrászazonosító már használatban van. Nyisd meg a meglévő fodrászt.');
 if(!newStaff&&!staff)fail(404,'A fodrász nem található.');
 if(!newStaff&&payload.active&&!staff.active)fail(409,'Inaktív fodrászhoz nem aktiválható belépés.');
 if(payload.copyHoursFrom&&(!newStaff||!STAFF_ID.test(payload.copyHoursFrom)||payload.copyHoursFrom===payload.staffId))fail(400,'Hibás munkaidőminta.');
 let sourceHours=[];
 if(payload.copyHoursFrom){
  const source=(await bookingDb('booking_staff',{query:{select:'id',id:`eq.${payload.copyHoursFrom}`,limit:'1'}}))[0];
  if(!source)fail(404,'A munkaidőmintához választott fodrász nem található.');
  sourceHours=await bookingDb('booking_hours',{query:{select:'weekday,opens,closes',staff_id:`eq.${payload.copyHoursFrom}`}});
 }
 // Client-generated staffId is stable across retries; partial creation stays inactive.
 if(newStaff&&!staff){
  const last=await bookingDb('booking_staff',{query:{select:'sort_order',order:'sort_order.desc',limit:'1'}});
  await bookingDb('booking_staff',{method:'POST',body:{id:payload.staffId,name,role:'Barber',active:false,sort_order:(last[0]?.sort_order||0)+1}});
  staff={id:payload.staffId,active:false};
 }
 if(!existing)await bookingDb('booking_managers',{method:'POST',body:{email,role:'barber',staff_id:payload.staffId,active:false}});
 let user=await findAuthUser(email);
 // Linking an existing guest/staff identity must never replace its credentials.
 if(user&&password)fail(409,'Ehhez az e-mail-címhez már tartozik Auth-fiók. Ürítsd a kezdő jelszót: a meglévő fiók változatlan jelszóval kapcsolódik, e-mailes kóddal is használható.');
 if(!user){
  const created=await authAdmin('users',{method:'POST',body:{email,...(password?{password}:{}),email_confirm:false,user_metadata:{full_name:name}}});
  const candidate=created?.user||created;
  if(!candidate?.id)fail(503,'A Supabase Auth-fiók még nem készült el.');
  const persisted=await authAdmin(`users/${encodeURIComponent(candidate.id)}`);
  user=persisted?.user||persisted;
 }
 if(!user?.id||user.email?.toLowerCase()!==email)fail(503,'A mentett Supabase Auth-fiók nem ellenőrizhető.');
 if(sourceHours.length)await bookingDb('booking_hours',{method:'POST',query:{on_conflict:'staff_id,weekday,opens,closes'},prefer:'resolution=ignore-duplicates,return=minimal',body:sourceHours.map(h=>({...h,staff_id:payload.staffId}))});
 await bookingDb('booking_staff',{method:'PATCH',query:{id:`eq.${payload.staffId}`},body:{name,...(newStaff?{active:true}:{})}});
 const saved=await bookingDb('booking_managers',{method:'PATCH',query:{email:`eq.${email}`,role:'eq.barber',staff_id:`eq.${payload.staffId}`,select:FIELDS},body:{active:payload.active},prefer:'return=representation'});
 if(saved.length!==1)fail(409,'A fiók időközben megváltozott.');
 return publicAccount(saved[0],user);
}
export async function setEmailStaffAccess(payload,manager){
 requireOwner(manager);
 const email=normalizedAdminEmail(payload.email);
 if(!email||typeof payload.active!=='boolean')fail(400,'Hibás fiókadat.');
 const existing=(await bookingDb('booking_managers',{query:{select:FIELDS,email:`eq.${email}`,role:'eq.barber',limit:'1'}}))[0];
 if(!existing)fail(404,'A fodrászfiók nem található.');
 let user=null;
 if(payload.active){
  if(isPlaceholderEmail(email))fail(409,'Előbb adj meg valódi e-mail-címet a helyőrző helyett.');
  user=await findAuthUser(email);
  if(!user)fail(409,'Előbb fejezd be az e-mailhez tartozó Auth-fiók létrehozását.');
  const staff=(await bookingDb('booking_staff',{query:{select:'id,active',id:`eq.${existing.staff_id}`,limit:'1'}}))[0];
  if(!staff?.active)fail(409,'Előbb fejezd be a fodrász hozzáadását.');
 }
 const saved=await bookingDb('booking_managers',{method:'PATCH',query:{email:`eq.${email}`,role:'eq.barber',staff_id:`eq.${existing.staff_id}`,select:FIELDS},body:{active:payload.active},prefer:'return=representation'});
 if(saved.length!==1)fail(409,'A fiók időközben megváltozott.');return publicAccount(saved[0],user);
}
export async function staffPasswordLogin(identifier,password){
 let email;try{email=staffLoginEmail(identifier)}catch{fail(401,'Hibás e-mail-cím vagy jelszó.');}
 if(typeof password!=='string'||!password||password.length>128)fail(401,'Hibás e-mail-cím vagy jelszó.');
 const manager=await managerByEmail(email);
 if(manager?.role!=='barber')fail(401,'Hibás e-mail-cím vagy jelszó.');
 const result=await authApi('token?grant_type=password',{method:'POST',body:{email,password}});
 if(result.status===429)fail(429,'Túl sok belépési kísérlet. Próbáld újra később.');
 const session=result.data;
 if(!result.ok||!session?.user?.id||session.user.email?.toLowerCase()!==email||!session.access_token||!session.refresh_token)fail(401,'Hibás e-mail-cím vagy jelszó.');
 return {session,manager};
}


// Explicit one-off provisioning: no passwords, verification bypass or outbound email.
// Preview is the default; only the trusted server/owner can apply this plan.
export async function provisionStaffPlaceholders(manager,{apply=false}={}){
 requireOwner(manager);
 const [staff,accounts]=await Promise.all([
  bookingDb('booking_staff',{query:{select:'id,name,active',active:'eq.true',order:'sort_order.asc,name.asc'}}),
  bookingDb('booking_managers',{query:{select:FIELDS,role:'eq.barber'}}),
 ]);
 const planned=staff.filter(s=>s.active&&!accounts.some(a=>a.staff_id===s.id&&!isPlaceholderEmail(a.email)))
  .map(s=>({...s,email:placeholderStaffEmail(s.id)}));
 if(!apply)return planned.map(s=>({staffId:s.id,name:s.name,email:s.email,active:false}));
 const existingUsers=await findAuthUsers(planned.map(s=>s.email));
 const results=[];
 for(const person of planned){
  const mapping=accounts.find(a=>a.email===person.email);
  if(mapping&&(mapping.role!=='barber'||mapping.staff_id!==person.id))fail(409,'A helyőrző cím másik fiókhoz tartozik.');
  if(!mapping)await bookingDb('booking_managers',{method:'POST',body:{email:person.email,staff_id:person.id,role:'barber',active:false}});
  let user=existingUsers.get(person.email);
  if(user&&(user.email_confirmed_at||user.app_metadata?.demeters_staff_id!==person.id||!user.app_metadata?.demeters_placeholder))fail(409,'A helyőrző Auth-fiók eredete nem ellenőrizhető.');
  if(!user){
   const created=await authAdmin('users',{method:'POST',body:{email:person.email,email_confirm:false,
    app_metadata:{demeters_staff_id:person.id,demeters_placeholder:true},user_metadata:{full_name:person.name}}});
   const candidate=created?.user||created;
   if(!candidate?.id)fail(503,'A helyőrző Auth-fiók nem készült el.');
   const saved=await authAdmin(`users/${encodeURIComponent(candidate.id)}`);user=saved?.user||saved;
  }
  if(!user?.id||user.email?.toLowerCase()!==person.email||user.email_confirmed_at)fail(503,'A helyőrző Auth-fiók mentése nem ellenőrizhető.');
  await bookingDb('booking_managers',{method:'PATCH',query:{email:`eq.${person.email}`,role:'eq.barber',staff_id:`eq.${person.id}`},body:{active:false}});
  results.push({...publicAccount({email:person.email,staff_id:person.id,active:false},user),name:person.name});
 }
 return results;
}

async function replacePlaceholderAccount(payload,manager){
 const previous=normalizedAdminEmail(payload.previousEmail),email=staffAccountEmail(payload.email);
 if(!isPlaceholderEmail(previous)||!STAFF_ID.test(payload.staffId||'')||typeof payload.active!=='boolean')fail(400,'Érvénytelen helyőrzőcsere.');
 const name=typeof payload.name==='string'?payload.name.trim():'';
 if(name.length<2||name.length>100||payload.password)fail(400,'Adj meg nevet és valódi e-mail-címet; a belépés e-mailes ellenőrzőkóddal történik.');
 const [oldRows,targetRows,staffRows]=await Promise.all([
  bookingDb('booking_managers',{query:{select:FIELDS,email:`eq.${previous}`,role:'eq.barber',staff_id:`eq.${payload.staffId}`,limit:'1'}}),
  bookingDb('booking_managers',{query:{select:FIELDS,email:`eq.${email}`,limit:'1'}}),
  bookingDb('booking_staff',{query:{select:'id,active',id:`eq.${payload.staffId}`,active:'eq.true',limit:'1'}}),
 ]);
 const old=oldRows[0],target=targetRows[0];
 if(!old||old.active)fail(409,'Csak letiltott helyőrző címe cserélhető ezen a módon.');
 if(!staffRows[0])fail(409,'A fodrász profilja nem aktív.');
 if(target&&(target.role!=='barber'||target.staff_id!==payload.staffId))fail(409,'A valódi e-mail-cím már másik kezelőhöz tartozik.');
 const users=await findAuthUsers([previous,email]);
 const originalUser=users.get(previous);let user=users.get(email);
 if(!user&&originalUser){
  if(originalUser.email_confirmed_at||originalUser.app_metadata?.demeters_staff_id!==payload.staffId||!originalUser.app_metadata?.demeters_placeholder)fail(409,'A helyőrző Auth-fiók eredete nem ellenőrizhető.');
  // Admin update does not send mail. Ownership is verified by OTP at first login.
  const changed=await authAdmin(`users/${encodeURIComponent(originalUser.id)}`,{method:'PUT',body:{email,email_confirm:false,
   app_metadata:{...originalUser.app_metadata,demeters_placeholder:false}}});
  const candidate=changed?.user||changed;
  if(!candidate?.id)fail(503,'Az Auth e-mail-címét nem sikerült módosítani.');
  const saved=await authAdmin(`users/${encodeURIComponent(candidate.id)}`);user=saved?.user||saved;
 }else if(!user){
  const created=await authAdmin('users',{method:'POST',body:{email,email_confirm:false,user_metadata:{full_name:name}}});
  const candidate=created?.user||created;
  if(!candidate?.id)fail(503,'Az Auth-fiók nem készült el.');
  const saved=await authAdmin(`users/${encodeURIComponent(candidate.id)}`);user=saved?.user||saved;
 }
 if(!user?.id||user.email?.toLowerCase()!==email)fail(503,'A valódi e-mail-cím mentése nem ellenőrizhető.');
 // Existing real guest/Auth users keep their identity and credentials unchanged.
 // A partial failure leaves the placeholder disabled; retry can finish the mapping.
 await bookingDb('booking_staff',{method:'PATCH',query:{id:`eq.${payload.staffId}`},body:{name}});
 let rows;
 if(target){
  rows=await bookingDb('booking_managers',{method:'PATCH',query:{email:`eq.${email}`,role:'eq.barber',staff_id:`eq.${payload.staffId}`,select:FIELDS},body:{active:payload.active},prefer:'return=representation'});
  await bookingDb('booking_managers',{method:'DELETE',query:{email:`eq.${previous}`,role:'eq.barber',staff_id:`eq.${payload.staffId}`,active:'eq.false'}});
 }else{
  rows=await bookingDb('booking_managers',{method:'PATCH',query:{email:`eq.${previous}`,role:'eq.barber',staff_id:`eq.${payload.staffId}`,active:'eq.false',select:FIELDS},body:{email,active:payload.active},prefer:'return=representation'});
 }
 if(rows?.length!==1)fail(409,'A helyőrző közben megváltozott. Frissítsd a listát.');
 return publicAccount(rows[0],user);
}
