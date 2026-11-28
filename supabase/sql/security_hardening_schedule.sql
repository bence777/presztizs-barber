-- OPTIONAL PRODUCTION SETUP: review and approve separately, AFTER migrations,
-- deployment and a successful authenticated manual worker request.
-- Supabase Cron/Vault already exist on the observed Free project. pg_net does not.
-- 1. Enable pg_net in Database > Extensions (registered in extensions schema).
-- 2. Vault UI: create demeters_jobs_url = https://demeters.hu/api/security-jobs
--    and demeters_cron_secret = the exact CRON_SECRET in the Vercel environment.
-- Never paste real secrets into this repository or cron command text.
begin;
create extension if not exists pg_net with schema extensions;
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all sequences in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
-- Fail before scheduling if the reviewed Vault values have not been configured.
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='demeters_jobs_url' and decrypted_secret='https://demeters.hu/api/security-jobs')
 or not exists(select 1 from vault.decrypted_secrets where name='demeters_cron_secret' and length(decrypted_secret)>=32) then
  raise exception 'Configure the reviewed Vault URL and CRON_SECRET first';
 end if;
end $$;
select cron.schedule('demeters-security-maintenance','0 * * * *',
 $$select public.booking_security_maintenance()$$);
select cron.schedule('demeters-outbox-dispatch','* * * * *',
 $$select net.http_get(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='demeters_jobs_url'),
  headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='demeters_cron_secret')),
  timeout_milliseconds:=30000
 )$$);
-- Keep operational history only for the new jobs, without touching other jobs.
select cron.schedule('demeters-security-job-history','20 3 * * *',
 $$delete from cron.job_run_details where end_time<now()-interval '14 days'
 and jobid in (select jobid from cron.job where jobname in ('demeters-security-maintenance','demeters-outbox-dispatch','demeters-security-job-history'))$$);
commit;
-- Rollback (manual): cron.unschedule each of the above THREE names only.
-- Keep pg_net/Vault and the original demeters-purge-expired-devices job intact.
