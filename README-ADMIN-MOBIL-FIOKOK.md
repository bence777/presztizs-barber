# DEMETERS: e-mailes fodrászfiókok, Supabase Auth és mobilos admin

## Fodrász és fiók hozzáadása

A főadmin **Fiókok** oldalán:

- **Saját fiók létrehozása**: meglévő fodrászhoz saját e-mail-cím kapcsolható.
- **Új fodrász hozzáadása**: új név és saját e-mail-cím megadásával új fodrász és hozzá tartozó Auth-fiók készül. A munkarend opcionálisan átvehető egy meglévő fodrásztól. Munkarend nélkül a fodrász a munkarend megadásáig nem foglalható.
- **E-mailes fiók hozzáadása**: egy meglévő fodrászhoz további saját e-mailes belépés rendelhető. A korábbi hozzáférés külön letiltható.
- Kezdő jelszó opcionálisan megadható egy teljesen új Auth-felhasználóhoz (12–128 karakter). Üresen hagyva e-mailes belépési kóddal használható a fiók.

A név és az e-mail-cím kötelező. Nincs automatikusan generált `.invalid` e-mail-cím vagy közös alapjelszó. A korábban felhasználónévvel létrehozott fiókok belépése kompatibilitási célból megmaradt; új ilyen fiók nem hozható létre.

## Mi történik mentéskor?

1. A szerver ellenőrzi az aktív főadminjogot, az e-mail-címet és a fodrászhozzárendelést. Főadminfiókot nem alakít át fodrászfiókká, és más fodrászhoz kötött e-mailt nem rendel át.
2. Új fodrásznál stabil, a mentés újrapróbálásakor is változatlan azonosítóval előkészíti a `booking_staff` sort. A félkész fodrász és a kezdeti kezelői jogosultság inaktív.
3. Megkeresi a valódi e-mail-címet a Supabase Auth felhasználói között. Ha nincs, az Auth Admin API-val létrehozza, majd az Auth felhasználóazonosítójával külön lekéréssel visszaellenőrzi a mentett rekordot. Így a felhasználó **azonnal megjelenik a Supabase Dashboard → Authentication → Users felületén**, már az első belépés előtt.
4. Ha az e-mailhez már létezik Auth-felhasználó, ugyanaz az azonosító kapcsolódik a fodrászhoz. Nem készül duplikált személy, nem változik a meglévő jelszó vagy a megerősített e-mail állapota. Ilyenkor a kezdő jelszó mezőt üresen kell hagyni; a szerver egy megadott új jelszót visszautasít.
5. A kiválasztott munkarendet másolja, majd befejezi a fodrász és a `booking_managers` jogosultság mentését. A sikeres válasz az Auth-felhasználó azonosítóját is tartalmazza. A felület enélkül nem jelez sikeres fióklétrehozást.

A fióklistán külön látszik, hogy a Supabase Auth-fiók létrejött-e. Sikertelen Auth-kérés nem aktivál új hozzáférést. A félkész létrehozás folytatható; újrapróbáláskor nem jön létre még egy fodrász, másolat Auth-fiók vagy azonos munkarend.

A fiók mentése nem küld meghívólevelet. A fodrász az `/admin` oldalon a saját címére **belépési kódot kér**, és az első bejelentkezéskor megerősíti az e-mail-címét. Az Auth-sor létrejötte és a cím megerősítése külön állapot: a létrehozás nem állítja önkényesen megerősítettre a személy e-mail-címét. A már beállított saját jelszó a Jelszavas belépés lapon is használható, e-mail-címmel. A korábbi főadmin-OTP-belépés megmaradt.

A fodrász csak a hozzárendelt naptárat, foglalásokat, vendégeket, statisztikákat és távolléteket érheti el. A jogosultságok ellenőrzése szerveroldalon és a meglévő RLS-szabályokon keresztül is történik. A Supabase titkos kulcsa kizárólag a szerveren használható.

## Naptár és mobil

- A Szabadságok oldalon csak távolléthez tartozó műveletek vannak: Új távollét, hónapválasztás, főadminnál fodrászszűrés. Nincs Új foglalás, vendégkereső vagy foglalási statisztika.
- A foglaláslista a kiválasztott hónapot mutatja, telefonon kártyákká rendezve. A fiókkezelő csak a fiókokhoz kapcsolódó műveleteket tartalmazza. A havi statisztikák a naptárban összecsukhatók.
- Minden napi/heti foglaláskártya 76 px magas, és az adott nap oszlopának azonos szélességét tölti ki. A kezdés, befejezés és időtartam feliratként szerepel. Az egyidejű foglalások egymás alá kerülnek. A valódi időtartam és ütközésellenőrzés adatbázis-intervallumokon alapul.
- Telefonon napi alapnézet, oldalra görgethető heti nézet, alsó navigáció, nagy kezelőszervek és egyoszlopos űrlapok vannak. A naptár munkakezdéshez görget; az idővonal nem takarja ki a vendégneveket.

## Adatbázis és telepítés

Ehhez a frissítéshez **nincs új SQL-migráció**. A meglévő `booking_staff`, `booking_managers`, `booking_hours`, `trusted_devices` és Supabase Auth szolgálja ki. A korábbi admin-RLS-migráció továbbra is szükséges; a már frissített projekten nem kell újra futtatni.

A változások helyben készültek. A böngészős tesztek mesterséges API-válaszokat használnak; nem hoztak létre éles felhasználót és nem küldtek levelet. Az éles fiók a főadmin mentésekor, az új kód telepítése után készül el. Nem történt Vercel-telepítés vagy éles adatbázismódosítás.

## Ellenőrzés

- `npm test`: 61 sikeres alkalmazásteszt. Külön ellenőrzött az Auth-létrehozás és visszaolvasás a jogosultság aktiválása előtt, meglévő Auth-fiók újrafelhasználása, jelszavának megőrzése, új fodrász hozzáadása, munkarend átvétele, részleges hiba utáni ismételt mentés, kizárólagos főadminjog és idegen fiók védelme.
- `npm run test:ui`: 19 böngészős funkcióellenőrzés, benne e-mailes fiók mentése és teljesen új fodrász hozzáadása.
- `npm run test:responsive`: 35 ellenőrzés 320, 360, 390, 430, 768, 1024 és 1440 px szélességen, az új e-mailes és fodrász-hozzáadó űrlappal együtt.
- `npm run build`: Next.js production build.

A böngészőtesztekhez a korábban használt külön QA-eszközök és a 3100 porton futó helyi előnézet szükséges. Példa: `DEMETERS_QA_MODULES=/private/tmp/demeters-qa DEMETERS_BROWSER='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' npm run test:ui`.

## Az e-mailes frissítés fájljai

`lib/server/staffAccounts.js`, `components/AdminStaffAccounts.jsx`, `components/AdminIdentityGate.jsx`, `pages/api/admin/auth/password.js`, `styles/AdminDashboard.module.css`, `tests/staff-accounts.test.mjs`, `tests/calendar.browser.mjs`, `tests/admin-responsive.browser.mjs`, ez a leírás. A meglévő `pages/api/admin/staff-accounts.js` API a bővített szolgáltatást használja változatlan főadmin-ellenőrzéssel.
