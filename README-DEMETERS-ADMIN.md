# DEMETERS adminfrissítés – 2026. november 16.

**Újabb frissítés:** a saját felhasználóneves fodrászbelépés és a mobilos javítások leírása a [README-ADMIN-MOBIL-FIOKOK.md](README-ADMIN-MOBIL-FIOKOK.md) fájlban található. Az alábbi telepítési állapot az első fejlesztési kör történeti leírása; az újabb, kizárólag olvasási ellenőrzés már megtalálta az éles projektben az admineszközre szűrő RLS-függvényt.

A meglévő Next.js Pages Router, Supabase Auth, e-mailes OTP, külön admin/vendég sütik, megbízható eszközök és foglalási táblák bővítése. Új foglalási rendszer vagy új futásidejű függőség nincs.

## Állapot és telepítés

**A kód helyben elkészült; az éles adatbázis-migráció nincs alkalmazva.** Az automatikus jóváhagyási ellenőrzés az éles projekt jogosultságainak és sémájának módosítását külön engedélyhez kötötte. Éles tesztfoglalás, e-mailküldés vagy felhasználó-létrehozás nem történt.

A felülvizsgált projekt: `fdvhdpguhqjmoojarurz` (`presztizs-barber`). A projektazonosító, technikai nevek, domainek, kulcsok, környezeti változók és munkamenet-azonosítók megmaradtak.

1. Jóváhagyás után a Supabase SQL Editorban egy tranzakcióban futtasd a `supabase/migrations/20261116100053_demeters_salon_admin.sql` fájlt. A meglévő adatmodellre épül, a korábbi SQL-fájlokat ezen a projekten ne futtasd újra. CLI-s alkalmazásnál az ottani migrációtörténetet is egyeztesd; ez a repository korábbi sémája nem teljes CLI-baseline.
2. Ezt követően telepítsd a kódot. **Az új kód a migráció új mezőire és RPC-jére támaszkodik; a migráció nélkül ne élesítsd.** Az alkalmazás Supabase-beállításai változatlanok. A szerver használja a meglévő `SUPABASE_PUBLISHABLE_KEY` értékét is a kezelői JWT-vel végzett, RLS-sel védett kérésekhez.
3. A valódi fodrászok e-mail-címeit rendeld hozzá a meglévő `booking_managers` táblában a megfelelő `booking_staff.id` értékhez, `barber` szerepkörrel. A vizsgált adatbázisban két aktív `owner` fiók volt; ezeket a migráció nem módosítja. Valós fodrászneveket és e-mail-címeket nem találtam ki.
4. Supabase Dashboard → Authentication → Email Templates → Magic Link: a tárgy legyen `DEMETERS – bejelentkezési kód`, a törzs a `supabase/templates/otp.html`. Az SMTP feladó megjelenítési neve is legyen DEMETERS. A foglalási Resend-levelek kódbeli tárgyai, törzsei és feladói megjelenítési neve már DEMETERS; a feladó e-mail-címe/domainje megmarad.

A fodrászhozzárendelés mintája (a példaértékeket valódi adatokkal helyettesítsd):

```sql
insert into public.booking_managers(email,role,staff_id,active)
values ('valodi-fodrasz@example.com','barber','barber-1',true)
on conflict(email) do update set role=excluded.role,staff_id=excluded.staff_id,active=true;
-- A booking_staff.email az értesítések címzettje, önmagában nem ad adminjogot.
update public.booking_staff set email='valodi-fodrasz@example.com' where id='barber-1';
```

## Működés

- A fodrász a saját naptárát kapja. A szerver minden API-hívásnál frissen ellenőrzi az aktív kezelői jogosultságot; ismeretlen szerepkör vagy hiányzó fodrászhozzárendelés esetén tilt. A naptár, az időpontmódosítás, az állapotváltás, a listák, a szabadságok és a statisztikák a megfelelő személyhez kötöttek.
- A főadmin választhat fodrászt vagy összesített szalonnézetet. A jogosultság nem kliensoldali szűrőn alapul: a kezelői kérések hitelesített JWT-t és a külön HttpOnly admineszköz igazolását továbbítják a Supabase-nek is. Az RLS érvényes admineszköz nélkül akkor is tilt, ha a vendégként belépett e-mail-címnek adminjoga van; visszavont eszközzel a közvetlen adatbázis-hozzáférés is azonnal megszűnik. Az RLS a megerősített `auth.users`-azonosságot és a `booking_managers` adatbázissorát használja; szerkeszthető JWT/user_metadata nem ad jogosultságot.
- Nap/hét/hónap és lista, Ma/előző/következő/dátumválasztó. Mobilon napi nézet, görgethető heti nézet és külön elérhető Szabadságok fül. Budapest szerinti jelenlegi idővonal, munkarenden kívüli sávok, elkülönített szabadság- és szünetblokkok. A naptár 30 másodpercenként és fókuszváltáskor frissül, amíg nincs nyitott szerkesztő.
- Üres idősávból kézi foglalás: név és telefon kötelező, e-mail opcionális, vendégfiók és OTP nem szükséges. Szolgáltatás, időtartam, ár, dátum, kezdés; szerkesztés, lemondás és meglévő végleges törlés. Az elvégzett szolgáltatás külön gombbal jelölhető teljesítettnek. Jövőbeli időpont nem zárható le teljesítettként.
- A szerver és adatbázistriggerek ellenőrzik az aktív szolgáltatást/fodrászt, az időtartamot, a munkaidőt, a munkarendi szüneteket, a távolléteket és az ütközéseket. A meglévő kizárási constraint-ek megmaradnak. A foglalások és szabadságok ugyanarra a fodrászra közös tranzakciós zárat használnak, így a párhuzamos online/kézi foglalás és szabadságmentés is védett.
- Egész napos távollétnél a befejező dátum is beletartozik. Többnapos részleges távollét minden kiválasztott napon csak a megadott órákat tiltja. A korábbi szabadságsorok folytonos intervallumként maradnak meg. Foglalással ütköző távollét nem menthető, és nem módosítja/törli a vendég foglalását.
- A publikus foglalhatóság a következő kérésben már figyelembe veszi a szabadságot és annak törlését. Az időpontlépés 15 másodpercenként és visszatéréskor frissül, a továbbra is szabad kiválasztott időpont megmarad; a végleges mentés mindig friss ellenőrzést és adatbázisvédelmet kap.
- A három kártya valódi PostgreSQL-aggregációból készül, a naptár keresése/lapozása nem módosítja. Összes foglalás: választott hónap, lemondottak nélkül. Havi hajvágás: az adott havi, kifejezetten `completed` státuszú, `counts_as_haircut=true` szolgáltatások. Mai foglalás: Budapest szerinti aktuális nap, a hónapválasztótól függetlenül. Az `is_demo=true` sorok egyik valós mutatóba sem számítanak bele.
- A migráció a megvizsgált hajvágás-szolgáltatásazonosítókat sorolja be, szakálligazítást nem. Új szolgáltatásnál a `counts_as_haircut` mezőt szándékosan kell beállítani; nincs névből végzett futásidejű becslés. A régi `confirmed` sorokat nem jelöli automatikusan teljesítettnek.
- A vendég neve/telefonja a jogosult foglalás pillanatképe. Az új online foglalások is eltárolják, a migráció a régi hiányzó adatokat megőrzi a kapcsolódó profilból. Az admin API nem olvas tetszőleges globális vendégprofilokat egy módosítható `user_id` alapján.
- A DEMETERS név a publikus, vendég-, admin-, eszközkezelő és tranzakciós e-mail-felületeken, az SEO-metaadatokban és a HairSalon strukturált adatban is megjelenik. A főoldal korábbi helyi szerkezeti módosításait megőriztem. A vendéglista korábbi `Europe/Debrecen` módosítása érvénytelen IANA-időzónát adott; a kötelező `Europe/Budapest` helyreállítja a működését.

## Migráció tartalma

Egy SQL-migráció: `supabase/migrations/20261116100053_demeters_salon_admin.sql`.

Új oszlopok: `booking_services.counts_as_haircut`, `booking_appointments.completed_at`, `booking_time_off.all_day`, `daily_start`, `daily_end`, `kind`. Új indexek a fodrász/hónap és távollét-lekérdezésekhez. Szűk, nem publikus `private` RLS-segédfüggvény, saját fodrászra szóló SELECT/INSERT/UPDATE/DELETE-szabályok, szolgáltatáskatalógus-olvasás kezelőknek, saját JWT-környezetben futó `booking_statistics` RPC, időpont- és távollétvédő triggerek. Az UPDATE policy `USING` és `WITH CHECK` feltételt is kap; más fodrászra áthelyezés tiltott. A korábbi, böngészőből egyébként is letiltott vendég SELECT policy helyére kezelői scope kerül; a vendégfolyamat továbbra is a külön ellenőrzött szerver API-t használja.

A migráció megszünteti a meglévő `public.rls_auto_enable()` eseménytrigger-segédfüggvény publikus RPC-végrehajthatóságát is, magát az eseménytriggert nem távolítja el. Nincs foglalást, fiókot vagy szerepkört törlő adatmigráció. A szolgáltatáskulcs kizárólag szerveroldalon marad.

## Ellenőrzés és korlátok

- `npm test`: 44/44 sikeres Node-teszt.
- `npm run build`: sikeres Next.js production build.
- Elkülönített PostgreSQL-integráció: 19/19 sikeres ellenőrzés; migráció fordítása, RLS, főadmin, idegen foglalás olvasásának/módosításának/törlésének tiltása, JWT-metaadat-hamisítás, anonim hozzáférés tiltása, munkaidő, szünet, szabadság és törlése, napi ismétlődés, teljesítés, havi statisztikák, Budapest/óraátállítás, párhuzamos mentések, azonnali jogosultság-visszavonás. A futó adatbázis kizárólag ideiglenes helyi adatokat tartalmaz, leállításkor törlődik.
- Böngészőteszt: 14/14 sikeres ellenőrzés; 390 px-es mobil és 1440 px-es asztali nézet, `America/New_York` böngésző-időzónával is Budapest szerinti naptár. A felületi műveletek determinisztikus API-válaszokkal futnak; ezek nem helyettesítik az élő OTP/e-mail/Supabase végponttól végpontig próbát. A valódi helyi Next API-kon külön ellenőrzött a hiányzó bejelentkezés és a cross-origin módosítás tiltása.
- Éles migráció, éles bejelentkezés és levélkézbesítés nincs tesztelve; ezek a migráció jóváhagyását és az éles telepítést követik. A Supabase advisor éles futtatás utáni vizsgálata is ekkor végezhető el.

A külön QA-eszközök szándékosan nem alkalmazásfüggőségek. Ismételhető helyi futtatás:

```sh
npm install --prefix /private/tmp/demeters-qa --save-exact playwright@1.56.1 embedded-postgres@18.1.0-beta.15
DEMETERS_QA_MODULES=/private/tmp/demeters-qa npm run test:db
# Előtte npm run build; külön terminálban npm run start -- --hostname 127.0.0.1 --port 3100
DEMETERS_QA_MODULES=/private/tmp/demeters-qa DEMETERS_BROWSER='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' npm run test:ui
```

Más rendszeren a `DEMETERS_BROWSER` helyére telepített Chromium útvonal adható, vagy Playwright Chromium telepítése után elhagyható. A DB-teszt alapértelmezett helyi portja 55439, az előnézeté 3100.

## Módosított és új fájlok

| Terület | Fájlok |
| --- | --- |
| Adminfelület | `components/AdminDashboard.jsx`, új `components/AdminTimeOff.jsx`, `styles/AdminDashboard.module.css`, `components/AdminIdentityGate.jsx`, új `lib/client/useDialog.js` |
| Szerver | `lib/server/adminCalendar.js`, `lib/server/bookingDb.js`, `lib/server/bookingManagement.js`, új `lib/server/timeOff.js`, `lib/server/bookingEmail.js` |
| Admin API | `pages/api/admin/calendar.js`, `pages/api/admin/bookings.js`, új `pages/api/admin/statistics.js`, új `pages/api/admin/time-off.js` |
| Vendégfolyamat | `components/BookingWizard.jsx`, `lib/client/bookingCache.mjs`, `pages/api/booking/availability.js`, `pages/api/booking/create.js` |
| Márkanév | `pages/index.jsx`, `pages/idopontfoglalas.jsx`, `pages/eszkozeim.jsx`, `pages/admin/eszkozok.jsx`, `pages/admin/foglalasok.jsx`, `components/BookingManagePage.jsx`, `components/BookingFooter.jsx`, `components/SalonStory.jsx`, `components/TrustSection.jsx` |
| SQL és OTP-sablon | `supabase/migrations/20261116100053_demeters_salon_admin.sql`, `supabase/templates/otp.html` |
| Tesztek | `tests/admin-dashboard.test.mjs`, `tests/booking-cache.test.mjs`, új `tests/salon-admin.test.mjs`, új `tests/database.integration.mjs`, új `tests/calendar.browser.mjs` |
| Egyéb | `package.json` (tesztparancsok), `.gitignore` (CLI ideiglenes állományai), ez a dokumentum |
