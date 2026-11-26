// Run against an isolated, disposable PostgreSQL; never connects to Supabase or reads .env.
import {createRequire} from 'node:module';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.env.DEMETERS_QA_MODULES||process.cwd(),'package.json'));
const EmbeddedPostgres=require('embedded-postgres').default;
const tmp=await mkdtemp(path.join(os.tmpdir(),'demeters-db-'));
const pg=new EmbeddedPostgres({databaseDir:path.join(tmp,'data'),user:'postgres',password:'local-test-only',port:55439,persistent:false,postgresFlags:['-k',tmp],onLog:()=>{},onError:()=>{}});
let client;let passed=0;
async function check(name,fn){await fn();passed++;console.log(`PASS ${name}`)}
const root=path.resolve(import.meta.dirname,'..');
const read=p=>readFile(path.join(root,p),'utf8');
try {
 await pg.initialise();await pg.start();client=pg.getPgClient();await client.connect();
 await client.query(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;grant usage on schema auth to authenticated,service_role;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;`);
 await client.query(await read('supabase/sql/real_booking.sql'));
 await client.query(await read('supabase/sql/guest_profiles.sql'));
 await client.query(await read('supabase/sql/01_trusted_devices_2026.sql'));
 await client.query('alter table public.booking_appointments add column guest_email text');
 await client.query(await read('supabase/sql/admin_dashboard_manual_bookings.sql'));
 await client.query(`alter table public.booking_staff add column email text;
 alter table public.booking_appointments add column is_demo boolean not null default false;
 alter table public.booking_appointments drop constraint booking_appointments_status_check;
 alter table public.booking_appointments add constraint booking_appointments_status_check check(status in ('confirmed','cancelled','completed','no_show'));
 create table public.booking_managers(email text primary key,role text not null check(role in ('owner','barber')),staff_id text references public.booking_staff(id),active boolean not null default true,created_at timestamptz default now(),check((role='owner' and staff_id is null) or (role='barber' and staff_id is not null)));
 alter table public.booking_managers enable row level security;grant all on public.booking_managers to service_role;`);
 await client.query(await read('supabase/sql/02_private_tables_lockdown_2026.sql'));
 await client.query(`insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','legacy@test.invalid',now());
 insert into public.guest_profiles(user_id,full_name,phone) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Legacy guest','+36301112222');
 insert into public.booking_staff(id,name) values('qa-legacy','Legacy');
 insert into public.booking_services(id,name,duration_minutes,price_huf) values('qa-legacy','Legacy',30,5000);
 insert into public.booking_appointments(user_id,staff_id,service_id,starts_at,ends_at,price_huf) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-legacy','qa-legacy','2026-10-01 10:00+02','2026-10-01 10:30+02',5000);`);
 await client.query(await read('supabase/migrations/20261116100053_demeters_salon_admin.sql'));
 await client.query(await read('supabase/migrations/20261125182900_monthly_appointments.sql'));
 await client.query(await read('supabase/migrations/20261125183014_secure_monthly_rpcs.sql'));
 await check('migration preserves legacy bookings and backfills their contact snapshots',async()=>{
  const legacy=(await client.query("select guest_name,guest_phone,status from public.booking_appointments where staff_id='qa-legacy'")).rows[0];assert.deepEqual(legacy,{guest_name:'Legacy guest',guest_phone:'+36301112222',status:'confirmed'});
 });
 await client.query(`delete from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';delete from public.booking_staff where id='qa-legacy';delete from public.booking_services where id='qa-legacy';`);
 console.log('PASS migration compiles against existing Supabase-shaped schema');passed++;
 const owner='11111111-1111-4111-8111-111111111111',barber='22222222-2222-4222-8222-222222222222',guest='33333333-3333-4333-8333-333333333333';
 await client.query(`insert into auth.users values ($1,'owner@test.invalid',now()),($2,'barber@test.invalid',now()),($3,'guest@test.invalid',now());`,[owner,barber,guest]);
 await client.query(`insert into public.booking_staff(id,name,active) values ('qa-one','One',true),('qa-two','Two',true);
 insert into public.booking_services(id,name,duration_minutes,price_huf,active,counts_as_haircut) values ('qa-cut','Cut',30,5000,true,true),('qa-beard','Beard',30,3000,true,false);
 insert into public.booking_hours(staff_id,weekday,opens,closes) select s,w,'09:00','12:00' from unnest(array['qa-one','qa-two']) s cross join generate_series(0,6) w;
 insert into public.booking_hours(staff_id,weekday,opens,closes) select s,w,'13:00','18:00' from unnest(array['qa-one','qa-two']) s cross join generate_series(0,6) w;
 insert into public.booking_managers(email,role,staff_id) values ('owner@test.invalid','owner',null),('barber@test.invalid','barber','qa-one');`);
 await client.query(`insert into public.trusted_devices(user_id,scope,credential_hash,device_name,expires_at) values
 ($1,'admin',encode(sha256(convert_to(repeat('A',43),'UTF8')),'hex'),'Owner device',now()+interval '7 days'),
 ($2,'admin',encode(sha256(convert_to(repeat('B',43),'UTF8')),'hex'),'Barber device',now()+interval '7 days'),
 ($3,'guest',encode(sha256(convert_to(repeat('C',43),'UTF8')),'hex'),'Guest device',now()+interval '7 days')`,[owner,barber,guest]);
 async function identity(id,conn=client){await conn.query('reset role');await conn.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-demeters-admin-device':(id===owner?'A':id===barber?'B':'C').repeat(43)})]);await conn.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(id?{sub:id,role:'authenticated'}:{role:'service_role'})]);await conn.query(`set role ${id?'authenticated':'service_role'}`);}
 const insert=async(staff,date,time,{service='qa-cut',status='confirmed',isDemo=false,manual=true,conn=client}={})=>{
  const {rows}=await conn.query(`insert into public.booking_appointments(staff_id,service_id,starts_at,ends_at,price_huf,status,guest_name,guest_phone,is_manual,is_demo)
   values($1,$2,($3::date+$4::time) at time zone 'Europe/Budapest',(($3::date+$4::time) at time zone 'Europe/Budapest')+interval '30 minutes',5000,$5,'Test guest','+36301234567',$6,$7) returning *`,[staff,service,date,time,status,manual,isDemo]);return rows[0];
 };
 const off=async(staff,date,start,end,{conn=client}={})=>conn.query(`insert into public.booking_time_off(staff_id,starts_at,ends_at,all_day,daily_start,daily_end) values($1,($2::date+$3::time) at time zone 'Europe/Budapest',($2::date+$4::time) at time zone 'Europe/Budapest',false,$3,$4) returning id`,[staff,date,start,end]);
 await identity(null);const a=await insert('qa-one','2026-11-10','10:00');const b=await insert('qa-two','2026-11-10','10:00',{manual:false});
 await check('barber RLS selects only own guests and cannot update/delete another staff booking',async()=>{
  await identity(barber);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,1);
  assert.equal((await client.query("update public.booking_appointments set guest_name='forbidden' where id=$1 returning id",[b.id])).rowCount,0);
  assert.equal((await client.query('delete from public.booking_appointments where id=$1 returning id',[b.id])).rowCount,0);
  await assert.rejects(()=>insert('qa-two','2026-11-10','11:00'),e=>e.code==='42501');
  await assert.rejects(()=>client.query("update public.booking_appointments set staff_id='qa-two' where id=$1",[a.id]),e=>e.code==='42501');
 });
 await check('owner RLS sees and edits all staff calendars',async()=>{await identity(owner);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,2);assert.equal((await client.query("update public.booking_appointments set guest_name='Owner edit' where id=$1 returning id",[b.id])).rowCount,1)});
 await check('guest JWT cannot bypass staff API with direct database queries',async()=>{await identity(guest);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);await assert.rejects(()=>insert('qa-one','2026-11-10','11:00'),e=>e.code==='42501')});
 await check('manual and online intervals cannot overlap; adjacent intervals are allowed',async()=>{await identity(null);await assert.rejects(()=>insert('qa-one','2026-11-10','10:15',{manual:false}),e=>e.code==='23P01');await insert('qa-one','2026-11-10','10:30')});
 await check('opening hours and split-shift breaks are enforced even with service_role',async()=>{await assert.rejects(()=>insert('qa-one','2026-11-10','08:30'),e=>e.code==='P0001');await assert.rejects(()=>insert('qa-one','2026-11-10','11:45'),e=>e.code==='P0001');await assert.rejects(()=>insert('qa-one','2026-11-10','12:00'),e=>e.code==='P0001')});
 await check('absences reject conflicting appointments without modifying them',async()=>{await assert.rejects(()=>off('qa-one','2026-11-10','10:00','11:00'),e=>e.code==='P0001');assert.equal((await client.query('select * from public.booking_appointments where id=$1',[a.id])).rowCount,1)});
 await check('absence CRUD is staff scoped; deleting absence makes slot bookable',async()=>{await identity(barber);const {rows}=await off('qa-one','2026-11-11','14:00','15:00');await assert.rejects(()=>off('qa-two','2026-11-11','14:00','15:00'),e=>e.code==='42501');await assert.rejects(()=>insert('qa-one','2026-11-11','14:00'),e=>e.code==='P0001');await client.query('delete from public.booking_time_off where id=$1',[rows[0].id]);await insert('qa-one','2026-11-11','14:00')});
 await check('multi-day partial absence repeats daily without blocking mornings',async()=>{await identity(null);await client.query(`insert into public.booking_time_off(staff_id,starts_at,ends_at,daily_start,daily_end) values('qa-one','2026-11-12 14:00+01','2026-11-14 15:00+01','14:00','15:00')`);await insert('qa-one','2026-11-13','13:00');await assert.rejects(()=>insert('qa-one','2026-11-13','14:30'),e=>e.code==='P0001');await insert('qa-one','2026-11-13','15:00')});
 await check('completed bookings remain occupied and future completion is rejected',async()=>{await identity(owner);await client.query("update public.booking_appointments set status='completed' where id=$1",[a.id]);assert.ok((await client.query('select completed_at from public.booking_appointments where id=$1',[a.id])).rows[0].completed_at);await assert.rejects(()=>insert('qa-one','2026-11-10','10:00'),e=>e.code==='23P01');await assert.rejects(()=>insert('qa-one','2099-01-01','10:00',{status:'completed'}),e=>e.code==='P0001')});
 await check('month statistics exclude cancelled/demo bookings and count only completed haircuts',async()=>{
  await identity(null);await insert('qa-two','2026-11-10','11:00',{status:'completed',service:'qa-beard'});await insert('qa-two','2026-11-10','11:30',{status:'cancelled'});await insert('qa-two','2026-11-10','14:00',{status:'completed',isDemo:true});
  await identity(owner);const all=(await client.query("select public.booking_statistics('2026-11-01',null) s")).rows[0].s;
  assert.equal(all.haircuts,1);const expected=(await client.query("select count(*)::int n from public.booking_appointments where status<>'cancelled' and not is_demo and starts_at>='2026-11-01 00:00+01' and starts_at<'2026-12-01 00:00+01'")).rows[0].n;assert.equal(all.total,expected);
  await identity(barber);const own=(await client.query("select public.booking_statistics('2026-11-01',null) s")).rows[0].s;assert.equal(own.haircuts,1);assert.ok(own.total<all.total);assert.equal((await client.query("select public.booking_statistics('2026-11-01','qa-two') s")).rows[0].s.total,0);
 });
 await check('Budapest month boundary and DST all-day absence use local dates',async()=>{
  await identity(null);await insert('qa-one','2026-10-31','17:00');await client.query(`insert into public.booking_time_off(staff_id,starts_at,ends_at,all_day) values('qa-two','2026-03-29 00:00+01','2026-03-30 00:00+02',true)`);await assert.rejects(()=>insert('qa-two','2026-03-29','10:00'),e=>e.code==='P0001');await insert('qa-two','2026-03-30','10:00');await identity(owner);assert.equal((await client.query("select public.booking_statistics('2026-10-01',null) s")).rows[0].s.total,1);
 });
 await check('concurrent booking/absence writes serialize in BOTH orders',async()=>{
  await identity(null);const other=pg.getPgClient();await other.connect();try {
   await identity(null,other);await client.query('begin');await insert('qa-one','2026-11-20','10:00');
   const pending=off('qa-one','2026-11-20','10:00','11:00',{conn:other}).then(()=>null,e=>e);await client.query('commit');assert.equal((await pending)?.code,'P0001');
   await client.query('begin');await off('qa-one','2026-11-21','10:00','11:00');
   const reversed=insert('qa-one','2026-11-21','10:00',{conn:other}).then(()=>null,e=>e);await client.query('commit');assert.equal((await reversed)?.code,'P0001');
   await client.query('begin');await insert('qa-one','2026-11-22','10:00');
   const collision=insert('qa-one','2026-11-22','10:00',{conn:other}).then(()=>null,e=>e);await client.query('commit');assert.equal((await collision)?.code,'23P01');
  }finally{await other.end()}
 });
 const monthly=async(staff,date,time,{userId=null}={})=>{
  const start=(await client.query("select ($1::date+$2::time) at time zone 'Europe/Budapest' t",[date,time])).rows[0].t;
  return (await client.query('select * from public.booking_create_monthly($1::jsonb)',[JSON.stringify({staff_id:staff,service_id:'qa-cut',starts_at:start,ends_at:new Date(+start+1800000),price_huf:5000,status:'confirmed',user_id:userId,guest_name:'Monthly guest',guest_phone:'+36301234567',is_manual:true})])).rows[0];
 };
 let recurring;
 await check('monthly rules clamp month ends, preserve Budapest time through DST, and have no end date',async()=>{
  await identity(barber);recurring=await monthly('qa-one','2032-01-31','10:00');assert.ok(recurring.monthly_series_id);
  const rows=(await client.query("select monthly_date::text d,starts_at from public.booking_appointments where monthly_series_id=$1 order by monthly_date",[recurring.monthly_series_id])).rows;
  assert.equal(rows.length,13);assert.equal(rows[1].d,'2032-02-29');assert.equal(rows[2].starts_at.toISOString(),'2032-03-31T08:00:00.000Z');
  await identity(null);await client.query("select public.booking_materialize_monthly('2099-02-01','2099-03-01','qa-one')");
  const distant=(await client.query("select monthly_date::text d,starts_at from public.booking_appointments where monthly_series_id=$1 and monthly_date>='2099-02-01'",[recurring.monthly_series_id])).rows[0];assert.equal(distant.d,'2099-02-28');assert.equal(distant.starts_at.toISOString(),'2099-02-28T09:00:00.000Z');
 });
 await check('deleted and cancelled monthly occurrences stay removed after repeated materialization',async()=>{
  await identity(barber);const rows=(await client.query("select id from public.booking_appointments where monthly_series_id=$1 order by monthly_date limit 3",[recurring.monthly_series_id])).rows;
  await client.query('delete from public.booking_appointments where id=$1',[rows[1].id]);await client.query("update public.booking_appointments set status='cancelled' where id=$1",[rows[2].id]);
  await identity(null);await client.query("select public.booking_materialize_monthly('2032-01-01','2032-05-01','qa-one')");
  assert.equal((await client.query('select id from public.booking_appointments where id=$1',[rows[1].id])).rowCount,0);assert.equal((await client.query('select status from public.booking_appointments where id=$1',[rows[2].id])).rows[0].status,'cancelled');
 });
 await check('individual monthly edits free the original slot and are not overwritten',async()=>{
  await identity(barber);await client.query("update public.booking_appointments set starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour',guest_name='Edited occurrence' where id=$1",[recurring.id]);
  await identity(null);await client.query("select public.booking_materialize_monthly('2032-01-01','2032-02-01','qa-one')");assert.equal((await client.query('select guest_name from public.booking_appointments where id=$1',[recurring.id])).rows[0].guest_name,'Edited occurrence');await insert('qa-one','2032-01-31','10:00');
 });
 await check('unmaterialized monthly reservations block distant online bookings and absences',async()=>{
  await identity(null);await assert.rejects(()=>insert('qa-one','2099-03-31','10:00',{manual:false}),e=>e.code==='23P01');await assert.rejects(()=>off('qa-one','2099-04-30','10:00','11:00'),e=>e.code==='P0001');
 });
 await check('a distant future conflict rolls back the entire series instead of silently skipping a month',async()=>{
  await identity(null);await insert('qa-two','2099-01-31','11:00');await identity(owner);
  await assert.rejects(()=>monthly('qa-two','2035-01-31','11:00'),e=>e.code==='23P01');assert.equal((await client.query("select id from public.booking_appointments where staff_id='qa-two' and starts_at='2035-01-31 11:00+01'")).rowCount,0);
 });
 await check('monthly rules reject month-end collisions with another rule',async()=>{
  await identity(barber);await assert.rejects(()=>monthly('qa-one','2035-01-28','10:00'),e=>e.code==='23P01');
 });
 await check('same-guest virtual monthly reservations across barbers cannot overlap',async()=>{
  await identity(owner);const linked=await monthly('qa-one','2035-01-28','16:00',{userId:guest});
  await assert.rejects(()=>monthly('qa-two','2035-01-31','16:00',{userId:guest}),e=>e.code==='23P01');
  await identity(null);await assert.rejects(()=>client.query("insert into public.booking_appointments(user_id,staff_id,service_id,starts_at,ends_at,price_huf,status,guest_name,guest_phone,is_manual) values($1,'qa-two','qa-cut','2099-02-28 16:00+01','2099-02-28 16:30+01',5000,'confirmed','Linked Guest','+36301234567',true)",[guest]),e=>e.code==='23P01');
  await identity(owner);await client.query('select public.booking_stop_monthly($1)',[linked.id]);
 });
 await check('monthly creation detects future absence conflicts and keeps later closed days reserved',async()=>{
  await identity(null);await off('qa-two','2099-02-28','15:00','15:30');await identity(owner);await assert.rejects(()=>monthly('qa-two','2035-01-31','15:00'),e=>e.code==='P0001');
  const closed=await monthly('qa-two','2035-01-31','17:00');await identity(null);const weekday=(await client.query("select extract(dow from date '2099-03-31')::int w")).rows[0].w;await client.query('reset role');const schedule=(await client.query("delete from public.booking_hours where staff_id='qa-two' and weekday=$1 returning opens,closes",[weekday])).rows;await identity(null);await client.query("select public.booking_materialize_monthly('2099-03-01','2099-04-01','qa-two')");assert.equal((await client.query("select id from public.booking_appointments where monthly_series_id=$1 and monthly_date='2099-03-31'",[closed.monthly_series_id])).rowCount,1);await client.query('reset role');for(const h of schedule)await client.query("insert into public.booking_hours(staff_id,weekday,opens,closes) values('qa-two',$1,$2,$3)",[weekday,h.opens,h.closes]);await identity(owner);await client.query('select public.booking_stop_monthly($1)',[closed.id]);
 });
 await check('monthly generation is idempotent under concurrent range requests',async()=>{
  await identity(null);const other=pg.getPgClient();await other.connect();try{await identity(null,other);await Promise.all([client.query("select public.booking_materialize_monthly('2040-01-01','2041-01-01','qa-one')"),other.query("select public.booking_materialize_monthly('2040-01-01','2041-01-01','qa-one')")]);assert.equal((await client.query("select count(*)::int n from public.booking_appointments where monthly_series_id=$1 and monthly_date>='2040-01-01' and monthly_date<'2041-01-01'",[recurring.monthly_series_id])).rows[0].n,12)}finally{await other.end()}
 });
 await check('guest and anonymous roles cannot generate or stop monthly bookings; barber cannot create another staff series',async()=>{
  await identity(guest);await assert.rejects(()=>monthly('qa-one','2036-01-01','16:00'),e=>e.code==='42501');await assert.rejects(()=>client.query("select public.booking_materialize_monthly('2040-01-01','2041-01-01',null)"),e=>e.code==='42501');await assert.rejects(()=>client.query('select public.booking_stop_monthly($1)',[recurring.id]),e=>e.code==='42501');
  await identity(barber);await assert.rejects(()=>monthly('qa-two','2036-01-01','16:00'),e=>e.code==='42501');
 });
 await check('stopping monthly recurrence deletes future confirmed occurrences and prevents regeneration',async()=>{
  await identity(barber);await client.query('select public.booking_stop_monthly($1)',[recurring.id]);await identity(null);await client.query("select public.booking_materialize_monthly('2099-01-01','2100-01-01','qa-one')");assert.equal((await client.query("select id from public.booking_appointments where monthly_series_id=$1 and status='confirmed'",[recurring.monthly_series_id])).rowCount,0);assert.equal((await client.query("select id from public.booking_appointments where monthly_series_id=$1 and status='cancelled'",[recurring.monthly_series_id])).rowCount,1);
 });
 await check('forged JWT email metadata does not grant owner privileges or global guest profiles',async()=>{await identity(guest);await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:guest,role:'authenticated',email:'owner@test.invalid',user_metadata:{role:'owner',email:'owner@test.invalid'}})]);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);await assert.rejects(()=>client.query('select * from public.guest_profiles'),e=>e.code==='42501')});
 await check('anonymous database role has no personal-data access',async()=>{await client.query('reset role');await client.query('set role anon');await assert.rejects(()=>client.query('select * from public.booking_appointments'),e=>e.code==='42501');await assert.rejects(()=>client.query("select public.booking_statistics('2026-11-01',null)"),e=>e.code==='42501');await identity(null)});
 await check('a manager guest JWT without the separate admin device cannot access the database',async()=>{await identity(owner);await client.query("select set_config('request.headers','{}',false)");assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);await client.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-demeters-admin-device':'C'.repeat(43)})]);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0)});
 await check('revoking an admin device immediately denies RLS even with an unexpired JWT',async()=>{await client.query('reset role');await client.query("delete from public.trusted_devices where user_id=$1",[owner]);await identity(owner);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0)});
 await check('deactivating a manager immediately revokes RLS access without refreshing JWT',async()=>{await client.query('reset role');await client.query("update public.booking_managers set active=false where role='barber'");await identity(barber);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0)});

 await client.query('reset role');
 await client.query("select set_config('request.jwt.claims','{}',false)");
 const beforeMigration=(await client.query('select id,price_huf,starts_at,ends_at from public.booking_appointments order by id')).rows;
 await client.query(await read('supabase/migrations/20261126093849_staff_services.sql'));
 await check('staff service migration preserves every booking, agreed price, duration and recurring series',async()=>{
  assert.deepEqual((await client.query('select id,price_huf,starts_at,ends_at from public.booking_appointments order by id')).rows,beforeMigration);
  assert.equal((await client.query('select count(*)::int n from public.booking_appointments where service_name_snapshot is null or duration_minutes_snapshot is null')).rows[0].n,0);
  assert.equal((await client.query('select count(*)::int n from public.booking_appointments a join public.booking_services s on s.id=a.service_id where s.staff_id<>a.staff_id')).rows[0].n,0);
 });
 await client.query("update public.booking_managers set active=true");
 await client.query(`insert into public.trusted_devices(user_id,scope,credential_hash,device_name,expires_at)
 values($1,'admin',encode(sha256(convert_to(repeat('A',43),'UTF8')),'hex'),'Owner device',now()+interval '7 days')`,[owner]);
 await identity(barber);
 await check('barber creates a personal 90 minute service and arbitrary positive integer durations',async()=>{
  await client.query(`insert into public.booking_services(id,staff_id,name,duration_minutes,price_huf,active)
    values('qa-color-one','qa-one','Color',90,15000,true),('qa-custom-one','qa-one','Custom',37,4000,true)`);
  await assert.rejects(()=>client.query("insert into public.booking_services(id,staff_id,name,duration_minutes,price_huf) values('qa-zero','qa-one','Zero',0,100)"),e=>e.code==='23514');
  await assert.rejects(()=>client.query("insert into public.booking_services(id,staff_id,name,duration_minutes,price_huf) values('qa-forbidden','qa-two','Forbidden',90,100)"),e=>e.code==='42501');
 });
 await identity(owner);
 await client.query("insert into public.booking_services(id,staff_id,name,duration_minutes,price_huf,active) values('qa-color-two','qa-two','Color',45,7000,true)");
 await check('same service name can have independent price and duration; barber cannot edit another catalog',async()=>{
  const rows=(await client.query("select price_huf,duration_minutes from public.booking_services where id in ('qa-color-one','qa-color-two') order by id")).rows;
  assert.deepEqual(rows,[{price_huf:15000,duration_minutes:90},{price_huf:7000,duration_minutes:45}]);
  await identity(barber);
  assert.equal((await client.query("update public.booking_services set price_huf=1 where id='qa-color-two' returning id")).rowCount,0);
  await assert.rejects(()=>client.query("update public.booking_services set staff_id='qa-two' where id='qa-color-one'"),e=>e.code==='42501');
  assert.equal((await client.query("update public.booking_staff set name='Forbidden' where id='qa-two' returning id")).rowCount,0);
  await assert.rejects(()=>client.query("update public.booking_staff set email='forbidden@test.invalid' where id='qa-one'"),e=>e.code==='42501');
 });
 const scopedInsert=async(staff,service,time,mins,{manual=true,conn=client,day='2045-06-05'}={})=>(await conn.query(`insert into public.booking_appointments(staff_id,service_id,starts_at,ends_at,price_huf,status,guest_name,is_manual)
 values($1,$2,($3::date+$4::time) at time zone 'Europe/Budapest',(($3::date+$4::time) at time zone 'Europe/Budapest')+make_interval(mins=>$5),1,'confirmed','Name only',$6) returning *`,[staff,service,day,time,mins,manual])).rows[0];
 let personal;
 await check('name-only manual booking derives price/name and allows an explicit duration override',async()=>{
  personal=await scopedInsert('qa-one','qa-color-one','09:00',45);
  assert.equal(personal.price_huf,15000);assert.equal(personal.guest_email,null);assert.equal(personal.guest_phone,null);
  assert.equal(personal.service_name_snapshot,'Color');assert.equal(personal.duration_minutes_snapshot,45);
  await scopedInsert('qa-one','qa-color-one','09:45',90);
  await assert.rejects(()=>scopedInsert('qa-one','qa-color-one','09:30',45),e=>e.code==='23P01');
 });
 await check('database rejects another staff service and incorrect public duration',async()=>{
  await assert.rejects(()=>scopedInsert('qa-one','qa-color-two','14:00',45),e=>['P0001','23503'].includes(e.code));
  await assert.rejects(()=>scopedInsert('qa-one','qa-color-one','14:00',45,{manual:false}),e=>e.code==='P0001');
 });
 await check('service edits and archived status preserve existing booking snapshots, even on reschedule',async()=>{
  await client.query("update public.booking_services set name='New name',price_huf=19000,duration_minutes=120 where id='qa-color-one'");
  await client.query("update public.booking_appointments set guest_name='Edited',price_huf=3,service_name_snapshot='Forged' where id=$1",[personal.id]);
  const snapshot=(await client.query('select price_huf,service_name_snapshot,duration_minutes_snapshot from public.booking_appointments where id=$1',[personal.id])).rows[0];
  assert.deepEqual(snapshot,{price_huf:15000,service_name_snapshot:'Color',duration_minutes_snapshot:45});
  await client.query("update public.booking_services set active=false,archived_at=now() where id='qa-color-one'");
  await assert.rejects(()=>scopedInsert('qa-one','qa-color-one','14:00',90),e=>e.code==='P0001');
  await client.query("update public.booking_appointments set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=$1",[personal.id]);
  assert.equal((await client.query('select price_huf from public.booking_appointments where id=$1',[personal.id])).rows[0].price_huf,15000);
 });
 await check('default service belongs to own active catalog and weekly hours writes retain RLS',async()=>{
  await assert.rejects(()=>client.query("update public.booking_staff set default_manual_service_id='qa-color-two' where id='qa-one'"),e=>e.code==='P0001');
  await client.query("update public.booking_staff set default_manual_service_id='qa-custom-one',public_phone='+36301234567',booking_step_minutes=7 where id='qa-one'");
  await assert.rejects(()=>client.query("select public.booking_save_hours('qa-two','[]')"),e=>e.code==='42501');
  await client.query("select public.booking_save_hours('qa-one',$1)",[JSON.stringify(Array.from({length:7},(_,weekday)=>({weekday,opens:'09:00',closes:'18:00'})))]);
 });
 await check('concurrent personal bookings cannot bypass database exclusion and schedule checks',async()=>{
  await identity(null);const other=pg.getPgClient();await other.connect();try{
   await identity(null,other);await client.query('begin');await scopedInsert('qa-one','qa-custom-one','14:00',37,{day:'2045-06-10'});
   const pending=scopedInsert('qa-one','qa-custom-one','14:15',37,{day:'2045-06-10',conn:other}).then(()=>null,e=>e);
   await client.query('commit');assert.equal((await pending)?.code,'23P01');
  }finally{await other.end()}
 });
 await check('monthly name-only bookings retain service snapshots for future materialization after price changes',async()=>{
  await identity(barber);
  const series=(await client.query(`select * from public.booking_create_monthly(jsonb_build_object('staff_id','qa-one','service_id','qa-custom-one','starts_at','2055-01-02 15:00+01','ends_at','2055-01-02 15:37+01','price_huf',1,'status','confirmed','guest_name','Name only','is_manual',true))`)).rows[0];
  assert.equal(series.price_huf,4000);assert.equal(series.service_name_snapshot,'Custom');
  await client.query("update public.booking_services set price_huf=9000,name='Custom new' where id='qa-custom-one'");
  await identity(null);await client.query("select public.booking_materialize_monthly('2060-01-01','2060-02-01','qa-one')");
  const occurrence=(await client.query("select * from public.booking_appointments where monthly_series_id=$1 and monthly_date='2060-01-02'",[series.monthly_series_id])).rows[0];
  assert.equal(occurrence.price_huf,4000);assert.equal(occurrence.service_name_snapshot,'Custom');assert.equal(occurrence.duration_minutes_snapshot,37);
 });

 await check('disabling the default clears it and profile edits remain possible',async()=>{
  await identity(barber);
  await client.query("update public.booking_services set active=false where id='qa-custom-one'");
  assert.equal((await client.query("select default_manual_service_id from public.booking_staff where id='qa-one'")).rows[0].default_manual_service_id,null);
  await client.query("update public.booking_staff set name='Renamed barber' where id='qa-one'");
 });
 await check('catalog tables and privileged helpers cannot be used by guests or anonymous roles',async()=>{
  await identity(guest);assert.equal((await client.query('select * from public.booking_services')).rowCount,0);
  await assert.rejects(()=>client.query("select public.booking_save_hours('qa-one','[]')"),e=>e.code==='42501');
  await assert.rejects(()=>client.query("delete from public.booking_services where id='qa-custom-one'"),e=>e.code==='42501');
  await client.query('reset role');await client.query('set role anon');
  await assert.rejects(()=>client.query('select * from public.booking_services'),e=>e.code==='42501');
  await assert.rejects(()=>client.query('select * from public.booking_staff'),e=>e.code==='42501');
  await client.query('reset role');
  assert.equal((await client.query("select has_function_privilege('anon','private.clear_inactive_default()','execute') allowed")).rows[0].allowed,false);
  assert.equal((await client.query("select prosecdef from pg_proc where oid='public.booking_save_hours(text,jsonb)'::regprocedure")).rows[0].prosecdef,false);
 });

 await client.query('reset role');await client.query("select set_config('request.jwt.claims','{}',false)");
 await client.query(`insert into public.booking_staff(id,name,active) values('barber-1','Első Barber',true),('barber-2','Második Barber',true),('barber-3','Valódi Fodrász',true);
 insert into public.booking_services(id,staff_id,name,duration_minutes,price_huf,active) values('cleanup-one','barber-1','Cut',30,5000,true),('cleanup-two','barber-2','Cut',30,5000,true),('cleanup-real','barber-3','Cut',30,5000,true);
 insert into public.booking_hours(staff_id,weekday,opens,closes) select 'barber-1',d,'09:00','18:00' from generate_series(0,6) d;
 insert into public.booking_appointments(staff_id,service_id,starts_at,ends_at,price_huf,status,guest_name,is_manual)
 values('barber-1','cleanup-one','2090-01-02 10:00+01','2090-01-02 10:30+01',5000,'confirmed','Future guest',true),
 ('barber-1','cleanup-one','2000-01-02 10:00+01','2000-01-02 10:30+01',5000,'confirmed','Historical guest',true);`);
 const retireSql=await read('supabase/migrations/20261126101520_retire_placeholder_staff.sql');
 await check('placeholder retirement refuses to hide a future real booking',async()=>{
  await assert.rejects(()=>client.query(retireSql),e=>e.code==='P0001');await client.query('rollback');
  assert.equal((await client.query("select active from public.booking_staff where id='barber-1'")).rows[0].active,true);
  await client.query("update public.booking_appointments set status='cancelled' where staff_id='barber-1' and starts_at>now()");
 });
 await check('placeholder retirement is repeatable, preserves history and never targets renamed real staff',async()=>{
  const before=(await client.query("select id,staff_id,service_id,price_huf,starts_at,ends_at,status from public.booking_appointments where staff_id='barber-1' order by id")).rows;
  await client.query(retireSql);await client.query(retireSql);
  const after=(await client.query("select id,staff_id,service_id,price_huf,starts_at,ends_at,status from public.booking_appointments where staff_id='barber-1' order by id")).rows;
  assert.deepEqual(after,before);
  assert.deepEqual((await client.query("select active from public.booking_staff where id in ('barber-1','barber-2') order by id")).rows,[{active:false},{active:false}]);
  assert.equal((await client.query("select active from public.booking_staff where id='barber-3'")).rows[0].active,true);
  assert.equal((await client.query("select active from public.booking_services where id='cleanup-one'")).rows[0].active,false);
  assert.equal((await client.query("select active from public.booking_services where id='cleanup-real'")).rows[0].active,true);
 });

 await client.query('reset role');await client.query("select set_config('request.jwt.claims','{}',false)");
 await client.query(await read('supabase/migrations/20261126103730_isolated_staff_sliding_devices.sql'));
 const secondBarber='44444444-4444-4444-8444-444444444444';
 await client.query("insert into auth.users values($1,'second@test.invalid',now())",[secondBarber]);
 await client.query("insert into public.booking_managers(email,role,staff_id) values('second@test.invalid','barber','qa-two')");
 await client.query(`insert into public.trusted_devices(user_id,scope,credential_hash,device_name,expires_at)
 values($1,'admin',encode(sha256(convert_to(repeat('D',43),'UTF8')),'hex'),'Second barber',now()+interval '7 days')`,[secondBarber]);
 async function secondIdentity(){await identity(secondBarber);await client.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-demeters-admin-device':'D'.repeat(43)})]);}
 await check('two separate barber identities see only their own profile, services, hours, bookings and absences',async()=>{
  for(const [id,staff] of [[barber,'qa-one'],[secondBarber,'qa-two']]){
   if(id===barber)await identity(barber);else await secondIdentity();
   assert.deepEqual((await client.query('select id from public.booking_staff')).rows,[{id:staff}]);
   for(const table of ['booking_services','booking_hours','booking_appointments','booking_time_off']){
    const rows=(await client.query(`select staff_id from public.${table}`)).rows;
    assert.ok(rows.every(row=>row.staff_id===staff),table+' leaked another staff');
   }
   const other=staff==='qa-one'?'qa-two':'qa-one';
   assert.equal((await client.query("update public.booking_staff set public_phone='+36309999999' where id=$1 returning id",[other])).rowCount,0);
   assert.equal((await client.query("select public.booking_statistics('2026-11-01',$1) s",[other])).rows[0].s.total,0);
   await assert.rejects(()=>client.query("select public.booking_save_hours($1,'[]')",[other]),e=>e.code==='42501');
  }
 });
 await check('inactive staff cannot use an otherwise active manager role or old admin JWT',async()=>{
  await client.query('reset role');await client.query("update public.booking_staff set active=false where id='qa-one'");
  await identity(barber);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);assert.equal((await client.query('select * from public.booking_services')).rowCount,0);
  await client.query('reset role');await client.query("update public.booking_staff set active=true where id='qa-one'");
 });
 await check('only the server role can touch a remembered device',async()=>{
  await identity(barber);await assert.rejects(()=>client.query("select * from public.booking_touch_trusted_device($1,'admin',repeat('a',64),true)",[barber]),e=>e.code==='42501');
  await client.query('reset role');await client.query('set role anon');await assert.rejects(()=>client.query("select * from public.booking_touch_trusted_device($1,'admin',repeat('a',64),true)",[barber]),e=>e.code==='42501');
 });
 const touch=async(user,scope,raw,extend=true,conn=client)=>(await conn.query("select * from public.booking_touch_trusted_device($1,$2,encode(sha256(convert_to($3,'UTF8')),'hex'),$4)",[user,scope,raw,extend])).rows;
 await check('admin sliding expiry is seven days; guest sliding expiry is sixty days; temporary usage preserves expiry',async()=>{
  await identity(null);
  const adminTouch=(await touch(barber,'admin','B'.repeat(43)))[0];assert.ok(+adminTouch.expires_at>Date.now()+6.99*86400000);
  const guestTouch=(await touch(guest,'guest','C'.repeat(43)))[0];assert.ok(+guestTouch.expires_at>Date.now()+59.99*86400000);
  const temporary=(await touch(barber,'admin','B'.repeat(43),false))[0];assert.equal(+temporary.expires_at,+adminTouch.expires_at);
  assert.equal((await touch(guest,'admin','C'.repeat(43))).length,0);assert.equal((await touch(barber,'admin','X'.repeat(43))).length,0);
 });
 await check('expired devices are never resurrected and a newer deadline is never shortened',async()=>{
  await client.query(`insert into public.trusted_devices(user_id,scope,credential_hash,device_name,created_at,expires_at)
   values($1,'guest',encode(sha256(convert_to(repeat('F',43),'UTF8')),'hex'),'Expired',now()-interval '2 days',now()-interval '1 day')`,[guest]);
  assert.equal((await touch(guest,'guest','F'.repeat(43))).length,0);
  const before=(await client.query("update public.trusted_devices set expires_at=now()+interval '90 days' where user_id=$1 and scope='guest' and device_name<>'Expired' returning expires_at",[guest])).rows[0].expires_at;
  assert.equal(+(await touch(guest,'guest','C'.repeat(43)))[0].expires_at,+before);
 });
 await check('device revocation wins against an in-flight sliding renewal',async()=>{
  await client.query(`insert into public.trusted_devices(user_id,scope,credential_hash,device_name,expires_at)
   values($1,'guest',encode(sha256(convert_to(repeat('G',43),'UTF8')),'hex'),'Revocation race',now()+interval '7 days')`,[guest]);
  const other=pg.getPgClient();await other.connect();try{
   await identity(null,other);await client.query('begin');await client.query("delete from public.trusted_devices where device_name='Revocation race'");
   const pending=touch(guest,'guest','G'.repeat(43),true,other);await client.query('commit');assert.equal((await pending).length,0);
  }finally{await other.end()}
 });
 console.log(`${passed} database checks passed`);
} finally {if(client)await client.end();await pg.stop().catch(()=>{});await rm(tmp,{recursive:true,force:true});}
