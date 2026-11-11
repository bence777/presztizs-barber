-- Already applied to the connected Presztizs Barber Supabase project.
-- Do NOT run this against the same project again unless needed for a fresh installation.
-- Manual appointments can belong to walk-in guests who have not signed in yet.
ALTER TABLE public.booking_appointments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.booking_appointments ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE public.booking_appointments ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE public.booking_appointments ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS booking_manual_email_idx
  ON public.booking_appointments (lower(guest_email))
  WHERE user_id IS NULL AND guest_email IS NOT NULL;
-- Booking overlap exclusion constraints remain untouched.
