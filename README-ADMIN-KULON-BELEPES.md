> **Frissítés:** a korábbi cookie- és belépési leírást a 2026-11-11-es eszköznyilvántartás és az opcionális megjegyzés módosította. Az aktuális működéshez olvasd el a `README-SECURITY-GDPR-ESZKOZOK.md` fájlt.

# Presztízs Barber – külön vendég- és adminbelépés

A legutóbbi Vercel-stílusú adminnaptár és e-mail-linkes projekt javítása.

## Mi volt a probléma?

A `/admin/foglalasok` oldalt a vendég `BookingIdentityGate` védte, és a kezelői API-k is a vendég `pb_access` munkamenetét vizsgálták. Ráadásul a vendégkapu a `guest_profiles` meglétét is ellenőrizte. Emiatt adminbelépés nélkül, illetve vendégprofil nélkül tévesen „Nincs jogosultságod” hiba jelent meg.

## Mostantól

- **Vendégoldal:** `/foglalasaim` – a korábbi, változatlan vendég OTP-belépéssel; saját `pb_access`, `pb_refresh`, `pb_device_until` cookie-k.
- **Admin és barberek:** `/admin` (átirányít a `/admin/foglalasok` címre) – új, önálló kezelői bejelentkezés, e-mail és 6–10 számjegyű egyszeri kóddal. Más profilra nincs szükség.
- A kezelői belépés **külön** `pb_admin_access`, `pb_admin_refresh` és aláírt `pb_admin_until` cookie-t tart fenn, legfeljebb 7 napos **abszolút** érvényességgel.
- Adminjogosultság csak a Supabase Authban igazolt e-mail-címhez kapcsolt, aktív `booking_managers` rekord alapján jár; ellenőrzés **minden kezelői API-híváskor** megtörténik.
- Egy tulajdonos minden foglalást kezelhet; a `barber` szerepkör csak a hozzárendelt barber foglalásaihoz fér hozzá a meglévő szerveroldali szűrések szerint.
- Az adminoldalon van **Kijelentkezés** gomb. Ez csak az admin cookie-kat törli, a vendégbelépést nem.
- A foglaláskezelő e-mailben szereplő `.../admin/foglalasok?booking=...` link továbbra is működik. Ha szükséges, a kezelő először az új adminbelépést látja, majd a foglalást.
- A meglévő vendégoldal, naptár, CRUD, foglalások és e-mail-sablonok **nem változnak**.

## Telepítés

1. A `presztizs-kulon-admin-belepes-frissitesek.zip` fájl tartalmát másold a **jelenlegi Next.js projekt gyökerébe**, az azonos fájlokat felülírva. Az új fájlokat és mappákat is másold át.
2. A meglévő `.env.local` változók működnek: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SIGNING_SECRET`. **Új titkos kulcs nem kell.**
3. `npm run dev` újraindítás.
4. Nyisd meg `http://localhost:3000/admin`, és add meg a korábban kezelőként felvett e-mail-címedet: `bencebalogh7777@gmail.com`.
5. Az e-mailben kapott OTP-kóddal lépj be. A profil kitöltése nem része az adminfolyamatnak.
6. A másik rendszer ellenőrzéséhez nyisd meg `http://localhost:3000/foglalasaim`. Vendégként továbbra is külön tudsz belépni.

**Fontos:** az admin fiók e-mail-címe a `booking_managers` táblában legyen aktív. Új barber kezelői e-mail-címét később ehhez a táblához kell hozzáadni, `role='barber'` és a megfelelő `staff_id` megadásával.

A belépési kódokat a már beállított **Supabase Auth SMTP** küldi. A foglalási visszaigazoló e-maileket továbbra is a **Resend API** küldi.

## Tesztelés

```bash
node --experimental-default-type=module --test tests/*.test.mjs
```

25 automatizált teszt sikeres a szerveroldali session-elkülönítésre és a meglévő funkciókra. A teljes Next.js build éles Supabase/Resend integrációval még helyileg ellenőrzendő.
