import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
export async function hardeningDatabase({client,pg,check,owner,barber,guest}) {
 await client.query('reset role');
 const sid=randomUUID(),bsid=randomUUID(),ssid=randomUUID(),second='44444444-4444-4444-8444-444444444444';
 await client.query(`create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,status text);`);
 await client.query('insert into auth.sessions values($1,$2),($3,$4),($5,$6)',[sid,owner,bsid,barber,ssid,second]);
 await client.query("update public.booking_managers set active=true where email in ('barber@test.invalid','owner@test.invalid');update public.booking_staff set active=true where id='qa-one'");
 const read=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
 for(const file of ['20261127221722_security_hardening_core.sql','20261127221728_security_hardening_auth.sql','20261127221729_security_hardening_outbox.sql'])await client.query(await read(file));
 await client.query('update public.trusted_devices set auth_session_id=case when user_id=$1 then $2::uuid when user_id=$4 then $3::uuid else $5::uuid end where scope=\'admin\'',[owner,sid,bsid,barber,ssid]);
 const identity=async(id,aal='aal2',conn=client)=>{await conn.query('reset role');await conn.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(id?{sub:id,role:'authenticated',aal,session_id:id===owner?sid:id===barber?bsid:ssid,amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]}:{role:'service_role'})]);await conn.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-demeters-admin-device':(id===owner?'A':id===barber?'B':'D').repeat(43),'x-request-id':randomUUID()})]);await conn.query(`set role ${id?'authenticated':'service_role'}`);};
 await check('hardening migrations preserve existing appointments and private tables deny all browser access',async()=>{
  await identity(owner);assert.ok((await client.query('select * from public.booking_appointments')).rowCount>0);
  for(const t of ['rate_limits','security_settings','notification_outbox','security_audit_log','booking_idempotency'])await assert.rejects(()=>client.query(`select * from private.${t}`),e=>e.code==='42501');
 });
 await check('owner with valid device and first factor cannot read or mutate admin data without AAL2',async()=>{
  await identity(owner,'aal1');assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);
  await assert.rejects(()=>client.query("insert into public.booking_services(id,staff_id,name,duration_minutes,price_huf) values('mfa-bypass','qa-one','Forbidden',30,5000)"),e=>e.code==='42501');
  await identity(owner);assert.ok((await client.query('select * from public.booking_staff')).rowCount>1);
 });
 await check('optional barber MFA becomes mandatory once a verified factor exists',async()=>{
  await identity(barber,'aal1');assert.equal((await client.query("select * from public.booking_staff where id='qa-one'")).rowCount,1);
  await client.query('reset role');await client.query('insert into auth.mfa_factors values($1,$2,\'verified\')',[randomUUID(),barber]);
  await identity(barber,'aal1');assert.equal((await client.query('select * from public.booking_staff')).rowCount,0);
  await identity(barber,'aal2');assert.equal((await client.query('select * from public.booking_staff')).rowCount,1);
 });
 await check('new AAL2 policies retain two-barber isolation and deny guest direct access',async()=>{
  for(const [id,staff] of [[barber,'qa-one'],[second,'qa-two']]){
   await identity(id);assert.deepEqual((await client.query('select id from public.booking_staff')).rows,[{id:staff}]);
   for(const table of ['booking_services','booking_hours','booking_appointments','booking_time_off'])assert.ok((await client.query(`select staff_id from public.${table}`)).rows.every(r=>r.staff_id===staff));
   assert.equal((await client.query("update public.booking_staff set name='Forbidden' where id=$1 returning id",[staff==='qa-one'?'qa-two':'qa-one'])).rowCount,0);
  }
  await identity(guest);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);
  await assert.rejects(()=>client.query('select * from public.trusted_devices'),e=>e.code==='42501');
 });
 await check('atomic shared limiter accepts exactly the quota under simultaneous independent connections',async()=>{
  const key='a'.repeat(64);const conns=Array.from({length:12},()=>pg.getPgClient());
  try{await Promise.all(conns.map(c=>c.connect()));const results=await Promise.all(conns.map(async c=>{await identity(null,'aal2',c);return (await c.query('select public.booking_rate_limit($1,5,60) r',[key])).rows[0].r}));assert.equal(results.filter(r=>r.allowed).length,5);assert.equal(Math.max(...results.map(r=>r.hits)),12);assert.ok(results.every(r=>r.retry_after>0));}finally{await Promise.all(conns.map(c=>c.end()));}
 });
 await check('failed-login backoff is shared, expires, and never changes an unrelated source',async()=>{
  await identity(null);const key='c'.repeat(64),other='d'.repeat(64);
  assert.equal((await client.query('select public.booking_login_backoff($1,false) d',[key])).rows[0].d,0);
  for(let i=0;i<4;i++)await client.query('select public.booking_login_backoff($1,true)',[key]);
  assert.ok((await client.query('select public.booking_login_backoff($1,false) d',[key])).rows[0].d>=400);
  assert.equal((await client.query('select public.booking_login_backoff($1,false) d',[other])).rows[0].d,0);
  await client.query('reset role');await client.query("update private.rate_limits set window_end=now()-interval '1 second' where key_hash=$1",[key]);
  await identity(null);assert.equal((await client.query('select public.booking_login_backoff($1,false) d',[key])).rows[0].d,0);
 });
 const user=randomUUID();await client.query('reset role');await client.query('insert into auth.users values($1,\'quota@test.invalid\',now())',[user]);
 // Resolve a still-active personal service from the preceding regression fixtures.
 await identity(null);const service=(await client.query("select id from public.booking_services where staff_id='qa-one' and active and archived_at is null limit 1")).rows[0]?.id;
 assert.ok(service);await client.query("update public.booking_services set duration_minutes=30 where id=$1",[service]);
 // Use a parameterized helper with the resolved catalog ID.
 const online=async(time,conn=client,extra={})=>(await conn.query(`insert into public.booking_appointments(user_id,staff_id,service_id,starts_at,ends_at,price_huf,status,is_manual,guest_name,guest_email) values($1,'qa-one',$2,$3::timestamptz,$3::timestamptz+interval '30 minutes',5000,$4,$5,'Quota Guest','quota@test.invalid') returning *`,[user,service,`2091-06-01 ${time}+02`,extra.status||'confirmed',extra.manual||false])).rows[0];
 let first;
 await check('quota serializes concurrent bookings; cancelled rows and manual exceptions remain usable',async()=>{
  first=await online('09:00');await online('09:30');const other=pg.getPgClient();await other.connect();
  try{await identity(null,'aal2',other);await client.query('begin');await online('10:00');const pending=online('10:30',other).then(()=>null,e=>e);await client.query('commit');assert.equal((await pending)?.message,'booking_quota');}
  finally{await other.end();}
  await online('11:00',client,{status:'cancelled'});await online('11:30',client,{manual:true});
  await client.query("update public.booking_appointments set status='cancelled' where id=$1",[first.id]);await assert.rejects(()=>online('12:00'),e=>e.message==='booking_quota');await client.query("update public.booking_appointments set status='cancelled' where user_id=$1 and is_manual",[user]);await online('12:00');
 });
 await check('optimistic revision permits only one of two editors; stale delete also conflicts',async()=>{
  const row=(await client.query('select * from public.booking_appointments where id=$1',[first.id])).rows[0];
  const other=pg.getPgClient();await other.connect();try{await identity(null,'aal2',other);await client.query('begin');await client.query("update public.booking_appointments set guest_name='First editor' where id=$1 and revision=$2",[row.id,row.revision]);const pending=other.query("update public.booking_appointments set guest_name='Second editor' where id=$1 and revision=$2 returning id",[row.id,row.revision]);await client.query('commit');assert.equal((await pending).rowCount,0);assert.equal((await client.query('delete from public.booking_appointments where id=$1 and revision=$2 returning id',[row.id,row.revision])).rowCount,0);}finally{await other.end();}
 });
 await check('transactional outbox survives email outage, rejects stale leases and deduplicates events',async()=>{
  await client.query('reset role');
  const rows=(await client.query("select * from private.notification_outbox where kind='receipt' and payload->'booking'->>'id'=$1",[first.id])).rows;assert.equal(rows.length,2);
  await identity(null);const claimed=(await client.query('select * from public.booking_claim_outbox(25)')).rows;assert.ok(claimed.length>0);
  const job=claimed[0];assert.equal((await client.query('select public.booking_finish_outbox($1,$2,false,\'upstream_timeout\') done',[job.id,job.lease_token])).rows[0].done,true);
  assert.equal((await client.query('select public.booking_finish_outbox($1,$2,true,null) done',[job.id,job.lease_token])).rows[0].done,false);
  await client.query('reset role');await client.query("update private.notification_outbox set status='processing',lease_until=now()-interval '1 minute',attempts=1 where id=$1",[job.id]);
  await identity(null);const recovered=(await client.query('select * from public.booking_claim_outbox(25)')).rows;assert.ok(recovered.some(r=>r.id===job.id&&r.lease_token!==job.lease_token));
 });
 await check('outbox and booking both roll back on failed quota writes',async()=>{
  await client.query('reset role');const n=(await client.query('select count(*) n from private.notification_outbox')).rows[0].n;
  await identity(null);await assert.rejects(()=>online('14:00'),e=>e.message==='booking_quota');await client.query('reset role');assert.equal((await client.query('select count(*) n from private.notification_outbox')).rows[0].n,n);
 });
 await check('idempotent booking is scoped by user and key, replays once, and rejects changed content',async()=>{
  await identity(null);const key=randomUUID(),hash=createHash('sha256').update('intent').digest('hex');
  const payload={staff_id:'qa-one',service_id:service,starts_at:'2092-06-01T08:00:00Z',ends_at:'2092-06-01T08:30:00Z',price_huf:5000,guest_name:'Idempotent',guest_email:'quota@test.invalid'};
  await client.query("update public.booking_appointments set status='cancelled' where user_id=$1",[user]);
  const other=pg.getPgClient();await other.connect();try{await identity(null,'aal2',other);await client.query('begin');const a=(await client.query('select public.booking_create_idempotent($1,$2,$3,$4) r',[user,key,hash,payload])).rows[0].r;
   const pending=other.query('select public.booking_create_idempotent($1,$2,$3,$4) r',[user,key,hash,payload]);await client.query('commit');assert.deepEqual((await pending).rows[0].r,a);
   await assert.rejects(()=>client.query('select public.booking_create_idempotent($1,$2,$3,$4)',[user,randomUUID(),hash,payload]),e=>e.code==='23P01');
   await assert.rejects(()=>client.query('select public.booking_create_idempotent($1,$2,$3,$4)',[user,key,'b'.repeat(64),payload]),e=>e.message==='idempotency_conflict');
   assert.equal((await client.query('select public.booking_idempotency_result($1,$2,$3) r',[guest,key,hash])).rows[0].r,null);
  }finally{await other.end();}
 });
 await check('staff account finalization commits profile and role mapping atomically with both revisions',async()=>{
  await client.query('reset role');const person=(await client.query("select revision from public.booking_staff where id='qa-one'")).rows[0];const mapping=(await client.query("select revision from public.booking_managers where email='barber@test.invalid'")).rows[0];
  const data={staffId:'qa-one',email:'barber@test.invalid',name:'Atomic account name',active:true,revision:mapping.revision,staffRevision:person.revision};
  await identity(null);await client.query('select public.booking_save_staff_account($1)',[data]);
  await assert.rejects(()=>client.query('select public.booking_save_staff_account($1)',[{...data,name:'Stale overwrite',active:false}]),e=>e.code==='40001');
  await client.query('reset role');assert.equal((await client.query("select name from public.booking_staff where id='qa-one'")).rows[0].name,data.name);assert.equal((await client.query("select active from public.booking_managers where email='barber@test.invalid'")).rows[0].active,true);
 });
 await check('weekly hours replacement checks the profile revision and rolls stale writes back',async()=>{
  await identity(owner);const revision=(await client.query("select revision from public.booking_staff where id='qa-one'")).rows[0].revision;
  const hours=Array.from({length:7},(_,weekday)=>({weekday,opens:'09:00',closes:'18:00'}));
  await client.query("select public.booking_save_hours('qa-one',$1,$2)",[JSON.stringify(hours),revision]);
  await assert.rejects(()=>client.query("select public.booking_save_hours('qa-one','[]',$1)",[revision]),e=>e.code==='40001');
  assert.equal((await client.query("select * from public.booking_hours where staff_id='qa-one'")).rowCount,7);
  await identity(null);
 });
 await check('deactivation revokes admin devices; reactivation cannot resurrect their cookies',async()=>{
  await client.query('reset role');await client.query("update public.booking_managers set active=false where email='barber@test.invalid'");
  await identity(null);assert.equal((await client.query("select * from public.booking_touch_trusted_device($1,'admin',encode(sha256(convert_to(repeat('B',43),'UTF8')),'hex'),true)",[barber])).rowCount,0);
  await client.query('reset role');await client.query("update public.booking_managers set active=true where email='barber@test.invalid'");await identity(barber);assert.equal((await client.query('select * from public.booking_staff')).rowCount,0);
 });
 await check('remote provider session deletion immediately invalidates bound admin RLS',async()=>{
  await client.query('reset role');await client.query('delete from auth.sessions where id=$1',[sid]);await identity(owner);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);
 });
 await check('audit is immutable to staff and stores field names without guest contacts or secrets',async()=>{
  await client.query('reset role');const rows=(await client.query('select * from private.security_audit_log')).rows;assert.ok(rows.length>0);assert.doesNotMatch(JSON.stringify(rows),/quota@test|Quota Guest|credential_hash/);
  await identity(owner);await assert.rejects(()=>client.query('delete from private.security_audit_log'),e=>e.code==='42501');
 });
 await check('Auth deletion anonymizes contact snapshots while retaining appointment history',async()=>{
  await client.query('reset role');const before=(await client.query('select count(*) n from public.booking_appointments where user_id=$1',[user])).rows[0].n;assert.ok(Number(before)>0);
  await client.query('delete from auth.users where id=$1',[user]);
  assert.equal((await client.query("select count(*) n from public.booking_appointments where guest_name='Törölt vendég' and user_id is null and guest_email is null and guest_phone is null")).rows[0].n,before);
  assert.equal((await client.query("select count(*)::int n from private.notification_outbox where payload->'booking'->>'user_id'=$1",[user])).rows[0].n,0);
 });
 await client.query('reset role');
 await check('profile drift reconciliation is replayable and preserves existing bilingual content and aliases',async()=>{
  const before=(await client.query("select public_slug,bio,bio_en from public.booking_staff where id='qa-one'")).rows;
  const repair=await read('20261127222902_reconcile_public_seo_profiles.sql');await client.query(repair);await client.query(repair);
  assert.deepEqual((await client.query("select public_slug,bio,bio_en from public.booking_staff where id='qa-one'")).rows,before);
 });
 await client.query('reset role');await client.query("select set_config('request.jwt.claims','{}',false)");
 await client.query(await read('20261128095716_booking_reminders_and_cancellation.sql'));
 let reminderBooking;
 await check('appointment reminder is queued exactly four hours before the start',async()=>{
  const service=(await client.query("select id from public.booking_services where staff_id='qa-one' and active and archived_at is null limit 1")).rows[0].id;
  reminderBooking=(await client.query("insert into public.booking_appointments(user_id,staff_id,service_id,starts_at,ends_at,price_huf,status,is_manual,guest_name,guest_email) values($1,'qa-one',$2,'2094-06-01 10:00+02','2094-06-01 10:30+02',5000,'confirmed',true,'Reminder','reminder@test.invalid') returning *",[guest,service])).rows[0];
  const job=(await client.query("select * from private.notification_outbox where kind='reminder' and payload->'booking'->>'id'=$1 and status='pending'",[reminderBooking.id])).rows;
  assert.equal(job.length,1);assert.equal(+reminderBooking.starts_at-+job[0].available_at,4*3600000);
  await client.query("update private.notification_outbox set created_at=now()-interval '60 days' where id=$1",[job[0].id]);
  await client.query('select public.booking_security_maintenance()');
  await identity(null);await client.query('select * from public.booking_claim_outbox(25)');await client.query('reset role');
  const retained=(await client.query('select status,payload from private.notification_outbox where id=$1',[job[0].id])).rows[0];assert.equal(retained.status,'pending');assert.equal(retained.payload.booking.id,reminderBooking.id);
  await client.query("update public.booking_appointments set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=$1",[reminderBooking.id]);
  assert.equal((await client.query("select * from private.notification_outbox where kind='reminder' and payload->'booking'->>'id'=$1 and status='pending'",[reminderBooking.id])).rowCount,1);
 });
 await check('guest cancellation is atomic, owner scoped, revision checked and invalidates the pending reminder',async()=>{
  const revision=(await client.query('select revision from public.booking_appointments where id=$1',[reminderBooking.id])).rows[0].revision;
  await identity(null);
  assert.equal((await client.query('select * from public.booking_cancel_guest($1,$2,$3)',[reminderBooking.id,owner,revision])).rowCount,0);
  assert.equal((await client.query('select * from public.booking_cancel_guest($1,$2,$3)',[reminderBooking.id,guest,revision])).rowCount,1);
  await client.query('reset role');assert.equal((await client.query("select * from private.notification_outbox where kind='reminder' and payload->'booking'->>'id'=$1 and status='pending'",[reminderBooking.id])).rowCount,0);
 });
 await check('guest cannot cancel inside four hours even by calling the cancellation RPC directly',async()=>{
  await client.query("delete from public.booking_hours where staff_id='qa-one';insert into public.booking_hours(staff_id,weekday,opens,closes) select 'qa-one',d,'00:00','23:59' from generate_series(0,6) d");
  const service=(await client.query("select id from public.booking_services where staff_id='qa-one' and active and archived_at is null limit 1")).rows[0].id;
  const row=(await client.query("insert into public.booking_appointments(user_id,staff_id,service_id,starts_at,ends_at,price_huf,status,is_manual,guest_name) select $1,'qa-one',$2,t,t+interval '30 minutes',5000,'confirmed',true,'Cutoff' from (select now()+case when extract(hour from (now()+interval '1 hour') at time zone 'Europe/Budapest')=23 then interval '2 hours' else interval '1 hour' end t) times returning *",[guest,service])).rows[0];
  await identity(null);assert.equal((await client.query('select * from public.booking_cancel_guest($1,$2,$3)',[row.id,guest,row.revision])).rowCount,0);
 });

}
