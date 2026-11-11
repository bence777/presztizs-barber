# Presztízs Barber – vendégazonosítás (Supabase Auth + SMTP)

A belépési/azonosítási folyamat **Supabase Auth e-mail OTP**, a küldés pedig a Supabase Dashboard **Authentication → SMTP Settings** részében beállított Resend SMTP-n történik.

A projekt korábbi Edge Function `supabase/functions/send-email/index.ts` fájlja az SMTP-s módszerhez nem szükséges. A **Send Email Hooknak kikapcsolva** kell lennie. `SEND_EMAIL_HOOK_SECRET` nem kell, és a Next.js az OTP-k küldéséhez nem használ `RESEND_API_KEY` értéket.

A Supabase Email Templates → Magic Link or OTP sablonban `{{ .Token }}` szükséges a numerikus kódhoz. A frontend és az API 6–10 számjegyű OTP-t kezelnek.

A 60 napos megjegyzett eszközhöz ezek a Next.js szerveroldali változók kellenek:

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SESSION_SIGNING_SECRET=<legalább-32-karakteres-véletlen-string>
```

Az adatbázisban a `guest_profiles` tábla és a saját sorokra korlátozó SELECT/INSERT/UPDATE RLS-policy szükséges. Ezt az összekapcsolt Supabase-projektedben már ellenőriztük és javítottuk.

A tényleges időpontfoglalás dokumentációja: **README-VALOS-FOGLALAS.md**.
