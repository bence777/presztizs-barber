-- Read-only. Run before approving production DDL; contains no contact/token data.
begin read only;
select version,name from supabase_migrations.schema_migrations order by version;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('booking_staff','booking_services','booking_appointments','trusted_devices','booking_managers') order by table_name,ordinal_position;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'booking_%';
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private') order by tablename,policyname;
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) definition from pg_constraint
where connamespace in ('public'::regnamespace,'private'::regnamespace) order by conrelid,conname;
select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','private') order by tablename,indexname;
select tgrelid::regclass as table_name,tgname,pg_get_triggerdef(oid) from pg_trigger where not tgisinternal
and tgrelid in (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')) order by tgrelid,tgname;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proacl,p.proconfig,md5(pg_get_functiondef(p.oid)) definition_hash
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by n.nspname,p.proname;
select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','private') order by table_name,grantee,privilege_type;
select table_name,column_name,data_type from information_schema.columns where table_schema='auth' and table_name in ('sessions','mfa_factors') order by table_name,ordinal_position;
commit;
