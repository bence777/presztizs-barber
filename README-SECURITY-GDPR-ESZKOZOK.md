# PRESZTÍZS BARBER — Biztonsági és adatvédelmi audit, 2026-11-11

**Állapot:** a feltöltött forráskód alapján végzett, statikus audit és mockolt API-tesztek. Nem minősül teljes penetrációs tesztnek, GDPR-tanúsításnak vagy éles Supabase-sémaellenőrzésnek.

## Rövid megállapítás

Az eredeti eszközfelismerés nem használ browser fingerprintet: a megjegyzés a Supabase Auth session cookie-in és egy aláírt határidő-cookie-n alapult. Előny, hogy nincs hardveres követés. Hátrány, hogy a saját rendszerben nem volt külön eszköznyilvántartás, így az egyedi visszavonás és a másik eszköz azonnali kizárása nem volt megvalósítva.

A jelen kiadás egy 32 bájtos, kriptográfiailag véletlen cookie-hoz kapcsolódó, **csak hash formában tárolt** szerveroldali munkamenet-nyilvántartást használ. Minden vendég/admin API-kérésnél ellenőrzi, hogy az eszköz aktív-e. Nincs IP, geolokáció, hardverazonosító, teljes User-Agent, canvas/audio fingerprint. Csak opcionális felhasználói elnevezés vagy széles kategória (pl. Safari · macOS), célhoz kötött belépési és utolsó használati időpont és lejárat.

## Mit kell telepíteni — kötelező sorrend

1. **KÉSZÍTS ADATBÁZIS-MENTÉST.** A megfelelő Supabase projekt SQL Editorában futtasd a `supabase/sql/01_trusted_devices_2026.sql` fájlt. Ez csak az új, zárt `trusted_devices` táblát készíti elő; a régi appot nem töri el.
2. A frissített Next.js projektet telepítsd. A meglévő `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SIGNING_SECRET`, Resend és `SITE_URL` változók szükségesek. **A Supabase secret key-t kizárólag szerveren tartsd, soha ne `NEXT_PUBLIC_` alatt.**
3. **Az új Next.js kód telepítése után** futtasd a `supabase/sql/02_private_tables_lockdown_2026.sql` állományt: ez megszünteti az `anon` és `authenticated` szerepek közvetlen hozzáférését a vendég-, foglalási, kezelői és egyéb belső táblákhoz. Előtte ellenőrizd, hogy más alkalmazás nem használja-e ezeket közvetlenül. Az itt átadott Next.js projekt már a szerveroldali API-n keresztül éri el a foglalási és vendégadatokat.
4. **A korábban megjegyzett eszközöknek egyszer újra kell azonosítaniuk magukat e-mail-kóddal**, mert a korábbi cookie-khoz még nem tartozik szerveroldali eszközrekord. Ez szándékos, és nem jelent profil- vagy foglalástörlést.
5. Konfigurálj napi automatikus tisztítást az `expires_at <= now()` rekordokhoz (példa a SQL fájl végén). Amíg nincs élesítve, lejárt rekordok maradhatnak a táblában, ezért ne ígérj automatikus időben történő törlést.
6. Futtasd a valós szerverrel a bejelentkezési, két böngészős, visszavonási és RLS-teszteket, illetve `npm audit` és Next.js production buildet. **Ebben a csomagban a valódi hálózatos integráció nem volt futtatható.**

### Új felületek

- Vendég: `/eszkozeim` — az időpontfoglaló és a `/foglalasaim` fejlécéből is elérhető.
- Admin/barber: `/admin/eszkozok` — a dashboard bal oldali navigációjából és mobilon a felső sávból.
- API: `/api/guest/devices` és `/api/admin/devices` (GET lista, PATCH név, DELETE visszavonás).
- Egyszerre több eszköz tartható aktívan. A vendég- és adminmunkamenetek teljesen külön scope-ban szerepelnek.
- Egy eszköz törlése csak **a hozzá tartozó munkamenetrekordot** törli, nem a vendégprofilt vagy a foglalásokat. Más eszközök bejelentkezése megmarad.
- A visszavont eszközt a szerver a **következő API-kéréskor** elutasítja. A nyitott vendég/admin képernyő egyperces időközönként és fókuszba kerüléskor újraellenőriz, és jogosultságvesztéskor elrejti a védett nézetet. Ha egy már megnyitott lapot nem frissítenek, annak korábban betöltött tartalma a memóriában még látható maradhat. A Supabase JWT az eredeti érvényességi ideje végéig létezhet; közvetlen profil-/foglalástábla-hozzáférés a mellékelt RLS-jogosultságszigorítással blokkolva van. A vendégfoglalás-kezeléshez az alkalmazásszerver ellenőrzése kötelező.

## Biztonsági megállapítások és fennmaradó kockázatok

| Súlyosság | Eredeti állapot / fennmaradó teendő | Javaslat |
| --- | --- | --- |
| MAGAS | Nem volt szerveroldalon egyedileg visszavonható eszköz | **Javítva**, `trusted_devices`, minden védett végpontnál ellenőrizve |
| MAGAS | A forrás szerint az `authenticated` szerepkör közvetlenül olvashatta saját `guest_profiles` és `booking_appointments` sorait a Supabase Data API-n keresztül | **Javítás a migrációban:** jogosultság visszavonva, a szerver jogosultságot ellenőriz és secret key-jel olvas. Éles RLS- és GRANT-ellenőrzés még kötelező |
| MAGAS | Az adminbelépés csak e-mail-fiók birtoklásán alapul | Adminoknak ajánlott később TOTP / passkey / MFA, érzékeny műveleteknél újraellenőrzés |
| MAGAS | OTP-elküldés és OTP-ellenőrzés előtt hiányzik a megbízható, központi IP-/fiókszintű sebességkorlát; a Supabase 429 önmagában nem teljes védelem | Vercel Firewall / Cloudflare és per-cím + per-hálózat atomikus Redis rate limit (rövid TTL, HMAC-hash az IP/email loghoz), OTP-visszaélés monitorozása. Megvalósítás és mérés hátravan |
| KÖZEPES | A korábbi „remember me” alapértelmezetten aktív volt | **Javítva:** 60 napos vendégmegőrzés és 7 napos adminmegőrzés külön, kikapcsolt alapállapotból választható; alapmunkamenet 12 óra vagy böngészőbezárás |
| KÖZEPES | Nem volt átlátható eszközlista és egyedi visszavonás | **Javítva:** külön vendég és admin kezelő, átnevezés, lejárati és utolsó használati adatok |
| KÖZEPES | Önálló cookie-, adatkezelési és megőrzési dokumentáció hiányos | **Nincs kész:** az adatkezelő pontos adatai, célok/jogalapok, partnerek, megőrzési idők, érintetti jogok, kapcsolat, incidenskezelés, adattovábbítás |
| KÖZEPES | Korábbi foglalások / vendégprofilok nem rendelkeznek dokumentált automatikus megőrzési és törlési szabállyal | Jogszabályos időtartamok alapján retention-mátrix, törlési/exportkérelem-folyamat, tesztfoglalások tisztítása |
| KÖZEPES | A képek egy része külső `images.unsplash.com` forrásról jön | Publikálás előtt saját tárhelyről kiszolgált, jogszerűen használható barber-/szalonfotók, így kevesebb harmadik fél felé irányuló lekérés |
| KÖZEPES | Nem auditálhatók az éles Supabase table privilege-ek és SMTP-OTP konfigurációk a ZIP-ből | Supabase RLS-policy és Data API jogosultságok, Auth-korlátok, SMTP, projekttitkok, kulcsrotáció ellenőrzése |
| KÖZEPES | Régi frontend-függőségek és nem ellenőrzött aktuális audit-eredmény | `npm audit`, `npm outdated`, Next.js biztonsági közlemények és kompatibilis, támogatott frissítési terv |
| ALACSONY | Hiányzó HTTP biztonsági fejlécek | **Javítva:** alap security headers és API no-store; később gondosan tesztelt szigorú CSP |

## GDPR teendők élesítés előtt

- A foglalás tipikus jogalapja a szolgáltatás előkészítéséhez/szerződés teljesítéséhez szükséges adatkezelés lehet (GDPR 6. cikk (1) b)); az admin-fiók, biztonsági napló vagy csalásmegelőzés jogalapját külön vizsgálni kell.
- A tartós „emlékezzen rám” opcionális és alapból kikapcsolt; tájékoztatni kell a felhasználót a 60/7 napos megőrzésről, a visszavonásról és a munkamenet-cookie céljáról. Az ePrivacy / magyar sütiszabályok szerinti szükségesség, illetve hozzájárulás jogi értékelését külön végezd el.
- Éles oldalon minden személyes adat bekérésekor könnyen elérhető, valós adatkezelési tájékoztató szükséges. A `GuestIdentity.jsx` jelenleg csak élesítés előtti figyelmeztetést tartalmaz; ez önmagában **nem elegendő**.
- Dokumentálandó szolgáltatók: Vercel, Supabase, Resend SMTP és a ténylegesen használt képszolgáltatók. Ellenőrizd az adatfeldolgozói szerződéseket, régiókat és az esetleges EU-n kívüli adattovábbítás jogalapját.
- Legyen eljárás adathozzáférésre, helyesbítésre, törlésre, adathordozhatóságra, jogosultságból adódó megőrzési kivételekre és incidens esetére. **Eszköz eltávolítása nem azonos a profil vagy foglalási előzmények törlésével.**
- Az éles rendszerből különítsd el a mintaadatokat és a tesztlevelezéseket.

## Két eszközös kézi teszt

1. Böngésző A: vendég OTP, „megjegyzés” aktív; böngésző B: ugyanazzal az e-maillel új OTP.
2. A `/eszkozeim` oldalon mindkét eszköz megjelenik, az A és B saját magát jelöli „EZ AZ ESZKÖZ”-ként.
3. A-ban töröld a B eszközt. B-ben `/api/guest/me` és `/foglalasaim` újratöltve 401/új belépés szükséges; A működik tovább.
4. A-ban töröld a saját eszközt; azonnal kijelentkezik.
5. Admin OTP külön e-maillel: `/admin/eszkozok`. Vendég cookie nem adhat hozzáférést az admin eszközlistához, a barber nem láthatja a tulajdonos eszközeit.
6. Ellenőrizd, hogy a Supabase RLS az `anon` és `authenticated` szerepkörökkel közvetlenül sem engedi olvasni a `trusted_devices`, `booking_managers`, `guest_profiles`, `booking_appointments` táblákat.
7. Teszteld a lejárt, manipulált vagy hiányzó eszköz-cookie-kat és a párhuzamos, másik eszközön folyamatban lévő törlést.

## Automatizált ellenőrzés

`node --experimental-default-type=module --test tests/*.test.mjs`

30 mockolt automatizált teszt sikeres (2026-11-11); külső Supabase, Resend, CDN és Next.js build integrációs teszt **nem történt meg** ebben a környezetben.

## Források

- EU GDPR (EU) 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/
- EDPB ePrivacy 2/2023 végleges útmutató: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en
- Supabase sessions: https://supabase.com/docs/guides/auth/sessions
- Supabase signout: https://supabase.com/docs/guides/auth/signout
