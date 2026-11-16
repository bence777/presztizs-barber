# DEMETERS: saját fodrászfiókok és mobilos admin

## Változások

- A főadmin **Fiókok** menüpontjában saját felhasználóneves/jelszavas belépést hozhat létre minden meglévő fodrászhoz. Előkészített nevek és azonosítók: Demeter Tamás / `demeter.tamas`, Fodrász 2 / `fodrasz.2`, Fodrász 3 / `fodrasz.3`. A jelszót a főadmin adja meg; nincs közös vagy forráskódba írt alapjelszó.
- A fodrász az `/admin` oldalon a **Fodrász belépés** lapon használja a saját felhasználónevét és jelszavát. Az eddigi főadmin- és e-mailes OTP-belépés az **E-mailes belépés** lapon megmaradt.
- A személyes fiók csak a hozzárendelt fodrász naptárát, foglalásait, vendégeit, statisztikáit és szabadságait érheti el. Másik fodrászra váltó szűrő és fiókkezelő menüpont csak főadminnak jelenik meg. Az API- és adatbázis-védelem változatlanul kikényszeríti a scope-ot.
- A főadmin szerkesztheti a fodrász nevét, új jelszót állíthat be, tilthatja és újra engedélyezheti a belépést. A felhasználónév meglévő fióknál nem változtatható, más fodrászhoz nem rendelhető át. A főadminfiókok nem módosíthatók ezzel a végponttal. A tiltás nem töröl foglalást; a jelszócsere visszavonja az adott személy korábbi admineszközeit is.
- A **Szabadságok** nézetben az egyetlen létrehozási művelet az **Új távollét**. Nincs Új foglalás gomb, vendégkereső, foglalásstátusz, foglalási statisztika vagy közelgő foglaláslista. Hónapválasztó és főadminnál fodrászszűrő tartozik hozzá.
- A **Foglalások** nézet a kiválasztott hónap listája, telefonon soronként kártyává rendezve. A **Fiókok** nézetben csak a fiókkezeléshez kapcsolódó műveletek vannak. A naptár havi statisztikái összecsukhatók. A globális oldalsávból kikerült az Új foglalás gyorsművelet.
- A napi és heti naptár minden foglalása **76 px magas**, és kitölti az adott nap oszlopának azonos szélességét. Az időtartam nem változtatja a kártyaméretet: a pontos kezdés, befejezés és időtartam feliratként szerepel. A vendégnév és a szolgáltatás külön sorban olvasható.
- Az egy időszakra eső foglalások egymás alá kerülnek, nem zsugorodnak az aktív fodrászok számának megfelelő keskeny sávokra. A közös félórás sorok szükség esetén együtt növekednek, a hét napjainak idővonalai együtt maradnak. A foglalhatóság és a valódi időtartam továbbra is az adatbázisban tárolt intervallum alapján ellenőrzött. A heti nézet oldalra görgethető; alapértelmezett telefonos nézet a nap.
- Telefonon fix alsó navigáció, legalább 44 px-es fontos kezelőszervek, teljes szélességű egyoszlopos űrlapok, 16 px-es mezőszöveg és képernyőn belül maradó panelek vannak. A naptár a munkakezdéshez görget, a jelenlegi idő vonala nem takarja ki a vendégneveket.

## Hitelesítés és adatbázis

Nem készült új adatbázisséma vagy migráció. A meglévő `booking_managers`, `booking_staff`, `trusted_devices` és Supabase Auth bővítésével működik. A felhasználónévhez nem kézbesíthető, belső `@staff.demeters.invalid` Auth-azonosító tartozik; ez nem kitalált valós postafiók, és nem küldünk rá levelet. A jelszavakat a Supabase Auth tárolja, az alkalmazás nem ment nyers jelszót saját táblába vagy naplóba.

A fiók létrehozásakor először letiltott jogosultságsor készül. Az Auth-fiók sikeres létrehozása után aktiválható. Ha az Auth-kérés hibázik, nincs használható aktív belépés; a művelet újrapróbálható. A fodrászfiókok szerveroldali kezelése kizárólag ellenőrzött főadminnak engedélyezett. A sikeres jelszavas belépés ugyanazt a külön HttpOnly adminmunkamenetet és külön megbízható admineszközt hozza létre, mint az eddigi OTP-s belépés. A vendégmunkamenet nem használható adminmunkamenetként.

A kapcsolt éles Supabase-projekten kizárólag olvasási ellenőrzés történt: két meglévő owner és három aktív fodrász van, saját barber belépés még nincs; az előző migráció admineszközre szűrt RLS-segédfüggvénye már jelen van. A szerverkulcs Auth Admin API-hozzáférése olvasási kéréssel ellenőrzött (HTTP 200). Ebben a körben nem módosult az éles adatbázis, nem jött létre éles Auth-fiók, nem ment ki e-mail és nem történt Vercel-telepítés.

Használat az új kód telepítése után: főadmin → Fiókok → adott fodrász → Saját fiók létrehozása → név, felhasználónév, legalább 12 karakteres saját jelszó → Fiók mentése. A belépési adatokat a főadmin adja át a fodrásznak.

## Ellenőrzés

- `npm test`: 53 sikeres alkalmazásteszt, benne jogosultság, fióklétrehozás, hibás létrehozás utáni újrapróbálás, idegen/owner fiók védelme, jelszócsere és személyes belépés.
- `npm run test:ui`: 18 sikeres böngészős funkcióellenőrzés, benne manuális foglalás, szabadságkezelés és főadmin fióklétrehozás/tiltás.
- `npm run test:responsive`: 35 sikeres ellenőrzés 320, 360, 390, 430, 768, 1024 és 1440 px szélességen. Minden szélességen naptár, azonos méretű kártyák, párhuzamos foglalások, heti görgetés, szabadságoldal/űrlap, lista, fiókkezelés/űrlap, személyes belépés és jogosultságtól függő navigáció.
- `npm run build`: sikeres Next.js production build. A böngészős tesztek mesterséges API-válaszokat használnak, nem éles fiókokat hoznak létre. A korábbi RLS- és tranzakciós adatbázisvédelem nem változott; annak 19 külön helyi PostgreSQL-tesztje megmaradt.

A két böngészőteszt-parancs előtt a már dokumentált QA-eszközök szükségesek (`DEMETERS_QA_MODULES=/private/tmp/demeters-qa`, telepített Playwright és Chromium/Brave, helyi előnézet a 3100 porton). A `test:responsive` ugyanazokat a környezeti változókat használja, mint a `test:ui`.

## Fájlok

- `components/AdminDashboard.jsx`, `components/AdminTimeOff.jsx`, `components/AdminIdentityGate.jsx`
- új `components/AdminStaffAccounts.jsx`, `lib/client/calendarLayout.mjs`, `lib/server/staffAccounts.js`
- új `pages/api/admin/staff-accounts.js`, `pages/api/admin/auth/password.js`
- `styles/AdminDashboard.module.css`, `styles/AdminAccess.module.css`
- `tests/calendar.browser.mjs`, új `tests/admin-responsive.browser.mjs`, új `tests/staff-accounts.test.mjs`
- `package.json`, ez a dokumentum és az előző adminleírás aktuális állapotjelzése
