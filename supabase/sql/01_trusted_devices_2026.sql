-- Presztízs Barber — secure, individually revocable browser sessions.
-- Apply ONCE in Supabase SQL Editor before deploying the accompanying app.
-- No device fingerprint, hardware ID, raw IP or full User-Agent is stored.
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('guest','admin')),
  credential_hash text NOT NULL UNIQUE CHECK (credential_hash ~ '^[0-9a-f]{64}$'),
  device_name text NOT NULL CHECK (char_length(device_name) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT trusted_devices_valid_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS trusted_devices_owner_idx ON public.trusted_devices(user_id,scope,expires_at);
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trusted_devices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.trusted_devices TO service_role;


-- Optional daily job if pg_cron / Supabase Cron is available. In SQL Editor:
-- SELECT cron.schedule('presztizs-purge-expired-devices', '15 3 * * *',
--   $$DELETE FROM public.trusted_devices WHERE expires_at <= now()$$);
-- If pg_cron is unavailable, configure a daily scheduled server action instead.
-- This cleanup must be enabled in production for accurate data-retention promises.
