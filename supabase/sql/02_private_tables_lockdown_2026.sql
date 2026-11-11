-- Run after deployment of the device-aware application, NOT before.
-- Remove browser-JWT access to PII-bearing tables; all reads/writes occur via
-- verified Next.js server-only endpoints and the secret Supabase key.
-- Defense in depth: private data is retrieved exclusively by the authenticated
-- Next.js API server using the secret key, not directly with browser JWTs.
ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_time_off ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_profiles, public.booking_appointments,
  public.booking_managers, public.booking_services, public.booking_staff,
  public.booking_hours, public.booking_time_off FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.guest_profiles, public.booking_appointments,
  public.booking_managers, public.booking_services, public.booking_staff,
  public.booking_hours, public.booking_time_off TO service_role;
-- Existing guests' SELECT policies are intentionally left in place but no longer
-- grant access without table privileges; avoid deleting policies in this release.

