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
 await check('forged JWT email metadata does not grant owner privileges or global guest profiles',async()=>{await identity(guest);await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:guest,role:'authenticated',email:'owner@test.invalid',user_metadata:{role:'owner',email:'owner@test.invalid'}})]);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);await assert.rejects(()=>client.query('select * from public.guest_profiles'),e=>e.code==='42501')});
 await check('anonymous database role has no personal-data access',async()=>{await client.query('reset role');await client.query('set role anon');await assert.rejects(()=>client.query('select * from public.booking_appointments'),e=>e.code==='42501');await assert.rejects(()=>client.query("select public.booking_statistics('2026-11-01',null)"),e=>e.code==='42501');await identity(null)});
 await check('a manager guest JWT without the separate admin device cannot access the database',async()=>{await identity(owner);await client.query("select set_config('request.headers','{}',false)");assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0);await client.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-demeters-admin-device':'C'.repeat(43)})]);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0)});
 await check('revoking an admin device immediately denies RLS even with an unexpired JWT',async()=>{await client.query('reset role');await client.query("delete from public.trusted_devices where user_id=$1",[owner]);await identity(owner);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0)});
 await check('deactivating a manager immediately revokes RLS access without refreshing JWT',async()=>{await client.query('reset role');await client.query("update public.booking_managers set active=false where role='barber'");await identity(barber);assert.equal((await client.query('select * from public.booking_appointments')).rowCount,0)});
 console.log(`${passed} database checks passed`);
} finally {if(client)await client.end();await pg.stop().catch(()=>{});await rm(tmp,{recursive:true,force:true});}
