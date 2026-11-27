# DEMETERS – foglalási rendszer, 2026. november 26.

A foglaló valós Supabase-adatbázist és külön vendég-/kezelői azonosítást használ. Az alábbi új kiadási útmutató az irányadó; a dokumentum végén lévő prototípusleírás történeti előzmény.

## Saját fodrászfiókok és gördülő eszközmegjegyzés

Minden fodrász külön `barber` jogosultságot kap a saját `staff_id` profiljához. Fodrászbejelentkezéssel a naptár, vendégadatok, foglalások, szolgáltatások, árak, munkaidő, szünetek, szabadságok, profilbeállítások és statisztikák a saját adatokra korlátozódnak. Az API a szerveroldali azonosítás alapján választ profilt, a Supabase RLS pedig ugyanazt kikényszeríti az admin JWT-vel és külön eszközazonosítóval. Az érintett katalógus-, szolgáltatás- és munkaidő-lekérdezések is a kezelő saját JWT-jét továbbítják. Inaktív fodrászprofil akkor sem ad hozzáférést, ha a régi kezelői jogosultság még aktív. A főadmin `owner` szerepe továbbra is kezeli az összes fodrászt és a fiókokat; fodrász nem kap ilyen jogot. Az ellenőrzött szerep/profil változásakor a felület újra létrejön az új jogosultságokkal, a korábbi nézet betöltött adatai törlődnek a komponens állapotából.

2026. november 26-án mind a hat alábbi helyőrző fiók ténylegesen létrejött **Supabase Authban is**. Mindegyik kizárólag a saját profiljához kapcsolódik, `barber` szereppel, letiltott belépéssel, nem hitelesített címmel, jelszó és levélküldés nélkül.

| Fodrász | Ideiglenes cím |
| --- | --- |
| Paliga Zoltán | `paliga-zoltan@pending.demeters.invalid` |
| Kovács Tibi | `kovacs-tibi@pending.demeters.invalid` |
| Nehéz Zsíros Bence | `nehez-zsiros-bence@pending.demeters.invalid` |
| Tóth Dominik | `toth-dominik@pending.demeters.invalid` |
| Hunyadi Róbert | `hunyadi-robert@pending.demeters.invalid` |
| Pelles Zsombor | `pelles-zsombor@pending.demeters.invalid` |

A címek nem kézbesíthetők. A főadmin Fiókok menüjében a **Valódi e-mail megadása** gombbal cserélhetők. Ha a valódi címhez még nincs Auth-felhasználó, az eredeti helyőrző Auth-fiók azonosítója marad meg az átnevezéskor. Ha már létezik vendég/Auth-fiók, azt kapcsoljuk a fodrászprofilhoz, a meglévő jelszó és igazolt vendégadatok módosítása nélkül. Más kezelő címét nem lehet átvenni. Az új cím tulajdonosa az első belépéskor kap OTP-kódot; a mentés nem igazolja automatikusan az e-mailt és nem küld levelet. A letiltott helyőrző cím közvetlenül nem aktiválható. A két meglévő főadminfiók változatlan maradt.

A `scripts/provision-staff-placeholders.mjs` alapból csak előnézetet ad; `--apply` kapcsolóval készíti el a hiányzó helyőrzőket. Ismételhető, és nem írja felül a már létező valódi fodrászfiókokat. Futtatás: `node --experimental-default-type=module --env-file=.env.local scripts/provision-staff-placeholders.mjs [--apply]`. A szerveroldali kulcsot soha ne másold kliensbe vagy parancssori argumentumba.

Megjegyzett eszköznél minden sikeresen ellenőrzött használat újraindítja a lejáratot:

- **Admin/fodrász: 7 nap** az utolsó használattól.
- **Vendég: 60 nap** az utolsó használattól.
- Az adatbázisbeli eszközlejárat, az aláírt munkamenet és a böngészős cookie-k együtt frissülnek.
- A „ne jegyezzen meg” beállítás továbbra is legfeljebb 12 órás ideiglenes munkamenet; nem válik tartóssá.
- Lejárt vagy visszavont eszközt a használat nem hozhat létre újra. A hosszabbítás csak a Supabase-azonosítás és az aláírt munkamenet egyezése után történik. A végső adatbázis-módosítás atomi, és eszköztörlési versenyhelyzetben sem állítja vissza a hozzáférést.

A `20261126103730_isolated_staff_sliding_devices.sql` migráció **lefutott a kapcsolt Supabase-projekten**; a helyi fájl verziója egyezik a távoli migrációtörténetével. Az új `booking_touch_trusted_device` RPC csak a szerveroldali `service_role` szerepnek hívható, böngészős JWT-nek és anonim kérésnek nem. Az RPC nem használ `SECURITY DEFINER` jogemelést. A felületi és Node.js-munkamenetváltozások a frissített alkalmazáskód kiadásakor lépnek életbe; automatikus production deployment nem történt.

Új ellenőrzések: `npm test`, `npm run test:db`, `npm run test:isolation`; a böngészős parancsok a lent dokumentált QA-függőségeket és helyi előnézetet használják. Futó fejlesztőszerver mellett elkülönített build készíthető: `DEMETERS_BUILD_DIR=.next-qa npm run build`, majd `DEMETERS_BUILD_DIR=.next-qa npm run start -- -p 3108`. Ez megelőzi, hogy a fejlesztőszerver és a production build felülírja egymás Next.js-gyorsítótárát. A normál buildkönyvtár továbbra is `.next`. Az új tesztek külön ellenőrzik két fodrász elkülönítését, inaktív profil tiltását, helyőrző létrehozását/cseréjét, 7/60 napos gördülést, ideiglenes munkamenetet, hibás azonosítást, lejárt eszközt és párhuzamos visszavonást. A végső eredmény: **91/91 JavaScript-teszt, 49/49 elkülönített PostgreSQL-ellenőrzés, 80/80 böngészős ellenőrzés és sikeres build**. A böngészős összesítés: 6 fiókelkülönítés/helyőrzőcsere, 25 adminnaptár, 35 reszponzív admin és 14 magyar/angol nyilvános foglalás. Az éles Auth-fiókok létrejöttét, letiltott állapotát és az új RPC böngészős hívásának tiltását külön olvasási lekérdezés is megerősítette.

## A frissítés tartalma

- Fodrászhoz kötött, szabadon létrehozható szolgáltatások: név, leírás, ár, pozitív egész percben megadott időtartam, sorrend, kikapcsolás és archiválás. A „Szolgáltatásaim” menü közvetlenül az adatbázist kezeli.
- „Saját beállítások”: megjelenített név, profilkép HTTPS-hivatkozással vagy meglévő helyi képpel, külön nyilvános telefonszám, kezdési lépésköz, alapértelmezett manuális szolgáltatás és heti munkaidősávok. A szabadságokat és szüneteket továbbra is a meglévő Szabadságok felület kezeli.
- Naptárból indított gyorsfoglalás: előválasztott fodrász/nap/kezdés/szolgáltatás; alaphelyzetben csak a vendég nevét kell beírni. A további beállítások lenyithatók, az időtartam felülírható. Telefon, e-mail és vendégfiók nem szükséges; e-mail nélkül az admin API nem indít értesítést.
- A nyilvános oldalon nincs dekoratív hero. Kompakt fodrászválasztó, kattintható körindikátorok, nyilvános `tel:` kapcsolat és fodrászonkénti aktív szolgáltatáslista jelenik meg. A várható összeg csak szolgáltatásválasztás után látszik. A magyar és angol szövegek támogatottak.
- A „Legkorábbi időpont” listájában minden szolgáltatás a konkrét fodrászához, árához és időtartamához tartozik; a rendszer nem helyettesíti egy másik fodrász azonos nevű szolgáltatásával. Ütközéskor ugyanahhoz a kiválasztott szolgáltatáshoz keres új időpontot.
- A naptáresemények magassága arányos a tényleges időtartammal, az egyidejű fodrászok külön oszlopokat kapnak. A kezdési lépésköz a foglalás hosszától független, a munkaidő kezdetétől számítódik.

## Mintaprofilok eltávolítása az aktív rendszerből

A `20261126101520_retire_placeholder_staff.sql` kizárólag a név és azonosító alapján ellenőrzött „Első Barber”, „Második Barber” és „Harmadik Barber” profilokat inaktiválja, szolgáltatásaikat archiválja és az esetleges kezelői belépéseiket tiltja. A foglalásokat nem törli vagy módosítja. A művelet ismételhető; átnevezett valódi fodrászt nem érint, jövőbeli valós foglalás vagy aktív havi ismétlés esetén visszagörget. A foglalási mentésekkel azonos tranzakciós zárolást használja.

A célzott adatjavítás 2026. november 26-án lefutott a kapcsolt Supabase-projekten. Mindhárom profil inaktív, a 15 saját szolgáltatás archivált, mind a 36 korábbi foglalás megmaradt; a hat valódi fodrász aktív maradt. Az alapértelmezett adminnaptár, foglaláslista és távollétlista az aktív fodrászokra szűr. A történeti foglalások azonosító szerinti elérése és a történeti statisztikák megmaradnak. A fiókkezelő a félbehagyott új fiókok beállításának folytatását továbbra is engedi. A felület már nem helyettesíti a neveket a három régi azonosítóhoz rendelt kitalált nevekkel. A felületi/API-változások kiadása külön lépés; automatikus deployment nem történt.

A célzott javítás ellenőrzése: **81/81 JavaScript-teszt, 43/43 helyi PostgreSQL-ellenőrzés és sikeres build**; az éles inaktiválás eredményét külön olvasási lekérdezés ellenőrizte.

## Supabase-migráció és kézi kiadási lépések

Új migráció: [`supabase/migrations/20261126093849_staff_services.sql`](supabase/migrations/20261126093849_staff_services.sql).

1. A meglévő sémán a `20261116100053_demeters_salon_admin`, `20261125182900_monthly_appointments` és `20261125183014_secure_monthly_rpcs` migrációknak már futniuk kell. A frissítést először tesztadatbázison ellenőrizd.
2. A kiadási ablakban, az alkalmazás frissítése előtt futtasd az új SQL-fájlt egyetlen tranzakcióként a megfelelő Supabase-projekten. A migráció zárolja a kapcsolódó táblákat az átvezetés idejére. Ezt a munkamenet nem futtatta az éles adatbázison; deployment sem történt.
3. A migráció a jelenlegi közös katalógust minden meglévő fodrásznak önálló példányként másolja át, mivel a korábbi séma minden fodrásznak ugyanazokat a szolgáltatásokat engedte. A régi sorok archiváltan megmaradnak. Nem kerülnek be a kérésben szereplő szemléltető példák. A meglévő foglalás- és haviismétlés-hivatkozások átvezetése megtörténik, az azonosítók, időpontok és árak megmaradnak.
4. A foglalás külön szolgáltatásnév- és időtartam-pillanatképet kap; a tárolt ár változatlan marad. A korábban nem tárolt történeti nevek nem rekonstruálhatók: az első névpillanatkép a migrációkori katalógusnév. Az új és migrált havi ismétlések későbbi előállítása is megőrzi az eltárolt nevet, árat és időtartamot.
5. A Supabase API séma-gyorsítótárának frissülése után ellenőrizd az admin „Szolgáltatásaim” és „Beállítások” menüit. Minden fodrász tekintse át a saját katalógusát és alapértelmezett szolgáltatását. A nyilvános telefonszám alapból üres, azt külön kell megadni; privát belépési adatból nem töltjük fel.
6. A korábbi környezeti változók és e-mail-beállítások maradnak. Nincs új tárolóbucket vagy új kulcs. A meglévő vendég OTP, visszaigazolás, foglaláskezelési és lemondási linkek folyamata tovább működik. A szolgáltatásazonosítók változnak; a korábbi szolgáltatásra mutató közvetlen linkekből szükség esetén válaszd újra a szolgáltatást.

## Jogosultságok és konzisztencia

Az új szolgáltatás-, profil- és munkaidő-módosítások a külön admin JWT-t és eszközazonosítót továbbítják a Supabase felé. Az RLS a meglévő `private.managed_booking_staff()` alapján kényszeríti ki a saját fodrászhoz tartozást; a tulajdonos minden fodrászt kezelhet. A profilfrissítéshez csak a megengedett oszlopok írhatók. A szolgáltatások tulajdonosa nem változtatható, végleges törlés helyett archiválunk. Anonim közvetlen táblahozzáférés nincs: a nyilvános API csak az aktív, nem archivált, megjelenített fodrászhoz tartozó katalógust adja vissza.

A foglalás és szolgáltatás tulajdonosi egyezését összetett idegen kulcs és trigger is ellenőrzi. A meglévő tranzakciós zárolások, ütközési exclusion constraintekkel együtt, az online és manuális mentéseket, szüneteket és havi ismétléseket továbbra is védik. Az adatbázis határozza meg az új foglalás árát és szolgáltatásnevét, ellenőrzi az online időtartamot, és megvédi a meglévő pillanatképeket. Az archivált szolgáltatások korábbi foglalásai tovább szerkeszthetők és áthelyezhetők.

Az ár- és szolgáltatásváltozások azonnali érvényesüléséhez a katalógus nem kap böngésző-/CDN-cache-t, a párhuzamos katalóguskérések összevonhatók. Az elérhetőség mindig friss katalógust, munkaidőt és foglaltságot használ; a mentés adatbázisszinten újra ellenőriz. Nincs fodrászonkénti N+1 lekérdezés. A katalógus fodrászhoz és sorrendhez indexelt.

## Érintett fájlok

| Terület | Fájlok |
| --- | --- |
| Admin felület | `components/AdminServices.jsx`, `components/AdminDashboard.jsx`, `styles/AdminServices.module.css`, `styles/AdminDashboard.module.css`, `lib/client/calendarLayout.mjs` |
| API és szerver | `pages/api/admin/services.js`, `pages/api/admin/settings.js`, `pages/api/admin/appointment.js`, `pages/api/booking/config.js`, `lib/server/staffSettings.js`, `lib/server/adminCalendar.js`, `lib/server/bookingDb.js`, `lib/server/bookingManagement.js` |
| Nyilvános foglalás | `components/BookingWizard.jsx`, `components/BarberCarousel.jsx`, `pages/idopontfoglalas.jsx`, `styles/BookingWizard.module.css`, `styles/BookingPage.module.css`, `styles/BarberStack.module.css`, `data/team.mjs`, `lib/client/bookingCache.mjs`, `lib/client/translations.mjs` |
| Migráció és ellenőrzés | Az új SQL-migráció, `tests/staff-services.test.mjs`, `tests/staff-services.browser.mjs`, a meglévő foglalási, jogosultsági és böngészős tesztek, `package.json`, ez a README |

## Ellenőrzés

A végső futtatás eredménye: **80/80 JavaScript-teszt, 41/41 elkülönített PostgreSQL-ellenőrzés, 90/90 böngészős ellenőrzés, sikeres `npm run build` és tiszta `git diff --check`**. A böngészős összesítés: 25 adminnaptár, 35 reszponzív admin (320–1440 px), 6 új szolgáltatás/beállítás, 14 nyilvános foglalás, 10 legkorábbi időpont/carousel. A böngészős üzleti műveletek teszt API-kat használtak; az RLS és a párhuzamos mentések valódi, helyi PostgreSQL-en futottak.

```sh
npm test
npm run build
# Külön tesztfüggőségek: embedded-postgres + pg, illetve playwright és Chromium.
# DEMETERS_QA_MODULES: a tesztfüggőségeket tartalmazó könyvtár abszolút elérési útja.
# DEMETERS_BROWSER: a meglévő Chromium futtatható állományának elérési útja (ha szükséges).
DEMETERS_QA_MODULES=/path/to/qa npm run test:db
# Futó helyi Next.js előnézettel; a böngészős tesztek API-helyettesítést használnak.
DEMETERS_QA_MODULES=/path/to/qa DEMETERS_PREVIEW_URL=http://127.0.0.1:3108 npm run test:ui
DEMETERS_QA_MODULES=/path/to/qa DEMETERS_PREVIEW_URL=http://127.0.0.1:3108 npm run test:responsive
DEMETERS_QA_MODULES=/path/to/qa DEMETERS_PREVIEW_URL=http://127.0.0.1:3108 npm run test:services
DEMETERS_QA_MODULES=/path/to/qa DEMETERS_PREVIEW_URL=http://127.0.0.1:3108 node tests/public-booking.browser.mjs
DEMETERS_QA_MODULES=/path/to/qa DEMETERS_PREVIEW_URL=http://127.0.0.1:3108 node tests/earliest-booking.browser.mjs
```

A projektnek nincs önálló `lint` vagy `typecheck` scriptje; a Next.js build elvégzi a konfigurált beépített ellenőrzéseket. Az adatbázisteszt átmeneti, elkülönített PostgreSQL-példányon fut, nem használja az `.env`-et és nem kapcsolódik Supabase-hoz.

---

## Korábbi prototípusdokumentáció

> **2026-11-11 / Biztonsági és GDPR-frissítés:** a legújabb változat telepítési sorrendje, új `/eszkozeim` és `/admin/eszkozok` kezelője, valamint a kötelező Supabase SQL fájlok leírása a **`README-SECURITY-GDPR-ESZKOZOK.md`** fájlban található. A jelen README régebbi, prototípus-állapotot ismertet.

# Presztízs Barber — főoldal (editorial)

Next.js **Pages Router** projekt. A meglévő hero videót, a fehér szolgáltatáskártyákat és a 3D-s barbergalériát változatlanul hagytuk, ezek után az alábbi három szekció került:

- `SalonStory.jsx` / `styles/SalonStory.module.css`: aszimmetrikus szalonbemutató, moody fotóval és videóból vett részlettel.
- `TrustSection.jsx` / `styles/TrustSection.module.css`: konverzió előtti bizalomépítő rész. **Nincsenek kitalált vendégvélemények**. Helyettük jelenleg három vállalt érték látható. A komponens elején lévő `REVIEWS` tömbbe később valódi, jóváhagyott értékelések írhatók; ekkor automatikusan értékeléseket jelenít meg.
- `BookingFooter.jsx` / `styles/BookingFooter.module.css`: erős foglalási CTA és lábléc.

A fejléc hibás `#munka` és `#rolunk` hivatkozásait létező szekciókhoz igazítottuk.

## Futtatás

```bash
npm install
npm run dev
```

## Kiélesítés előtt kötelező

1. **A valós szalonfotót** add hozzá, és módosítsd a `SALON_IMAGE` értéket a `components/SalonStory.jsx` fájlban. Jelenleg Unsplash hangulatkép van megadva, hálózati hiba esetén helyi, korábbi prototípus-kép a fallback. A fotó mellett külön, diszkrét figyelmeztetés szerepel a demón.
2. **Valódi vendégvélemények** csak engedéllyel/nyilvános forrás alapján kerüljenek be a `TrustSection` `REVIEWS` tömbjébe. Addig az értékek szekció jelenik meg.
3. **Valós foglalórendszer** még nincs. Az új `pages/idopontfoglalas.jsx` csak egy jól kinéző, `noindex` demóoldal, amely őszintén jelzi, hogy a foglalás nem aktív. Ezt a meglévő külső foglalóval vagy a készülő belső foglalással kell összekötni.
4. **Szolgáltatások, árak, barbernevek, portrék** az eredeti, feltöltött projektben is mintaadatok voltak. Ezeket ellenőrizni kell a publikálás előtt.
5. **Cím, nyitvatartás és elérhetőségek** nem szerepeltek a mellékelt forrásban, ezért nem kerültek kitalálásra a láblécben.

## Fájlstruktúra

A projekt `components`, `styles`, `pages`, `public` mappái megmaradtak. Nincs `src/` könyvtár, a CSS fájlok továbbra is a `styles/` mappában vannak.

## 2026. november 27. – Kétnyelvű SEO és publikus oldalak

Elkészült az adatbázis-alapú publikus árlista, a magyar–angol szolgáltatási oldalak, a feltölthető fodrászprofilok, a központi metadata/JSON-LD, sitemap, robots, FAQ, lokációs adatkonfiguráció és 1200 × 630 pixeles OG-képvégpont. A foglaló külön, késleltetett chunkban töltődik be. A production domain a tulajdonos által megadott `https://demeters.hu`.

A teljes fájllista, URL-ek, migráció, hiányzó üzleti adatok, hozzájárulásos analitikai események, tesztparancsok és Search Console teendők: [SEO-átadás](docs/seo-handoff.md). Az új migráció **még nincs éles adatbázison alkalmazva**, és production deploy nem történt. Üres bemutatkozású fodrászból nem készül indexelhető profil. Az oldal a migráció előtt is használható, a valós szolgáltatási árakkal.

Új parancsok: `npm run lint`, `npm run test:seo`. A korábbi, lint hiányára és tesztszámokra vonatkozó bekezdések történeti állapotot írnak le; az aktuális átadás eredményeit az új dokumentum tartalmazza.

A főoldal elrendezése később módosult: hero → fodrászok → időpontfoglalás → szemlélet/galéria/lokáció/FAQ → A szalon → lábléc. A DEMETERS / MENU blokk lekerült a főoldalról; a külön árlista és szolgáltatási oldalak továbbra is elérhetők. Az angol hero címe „Premium men's hair salon in Debrecen”, középen hangsúlyos foglalási gombbal.

Az aloldalak külön elrendezést kaptak: az árlistán fodrászindex és szolgáltatási áttekintés, a csapatoldalon az alapító meglévő portréja és váltakozó fodrászbemutatások, a szolgáltatásoknál saját nyitókompozíció és valós ár-/időtartam-adatok, a kapcsolatoldalon önálló várostipográfia és foglalási útmutató, a profilokon személyes nyitórész és aszimmetrikus portfólió szerepel. Az új oldalspecifikus elemek a `components/InnerPageHeroes.jsx` és `styles/InnerPages.module.css` fájlokban találhatók. A mobilos navigáció minden publikus menüpontot láthatóvá tesz. Új célzott navigációs ellenőrzés: `node tests/inner-pages.browser.mjs`, a korábban dokumentált SSR fixture szerverrel és QA-változókkal.

Az aloldalak új elrendezését sikeres production build, 105 JavaScript-teszt, 11 SEO-böngészőtesztcsoport és 6 célzott navigációs/foglalási előválasztás-ellenőrzés igazolta. A reszponzív nézetek 320, 390, 768 és 1440 px szélességen ellenőrizve; a lint hibamentes, a korábbi figyelmeztetésekkel.

A fodrászválasztó érintéses húzásának elengedését sebességalapú, fokozatosan lassuló mozgás követi. A pozíció nem a húzás kezdetére áll vissza, a gyors pöccintés több fodrászon át és a lista végén körbe is továbbfut. Új érintés azonnal megállítja a lendületet. Ellenőrzés: 109 JavaScript-teszt és 8 mobilos érintéses böngészőteszt a főoldali és foglalási választón. Célzott teszt: `tests/carousel-momentum.browser.mjs`, a korábban dokumentált SSR fixture előnézettel.

A fodrászválasztó támogatott érintéses böngészőben finom rezgésjelzést kapott: rövid impulzus a kártya középen történő áthaladásakor, ritkított visszajelzés gyors pörgetéskor és külön jelzés megálláskor. A „Rezgés” kapcsoló közös a főoldali és foglalási választóban, beállítása helyben megmarad. Betöltés, egér/trackpad és programozott navigáció nem indít rezgést; háttérbe tett lap, kikapcsolt visszajelzés vagy reduced-motion beállítás esetén a jelzések leállnak. Nem támogatott böngészőben (például iPhone Safari) a kapcsoló sem jelenik meg. Új fájlok: `lib/client/carouselHaptics.mjs`, `lib/client/useCarouselHaptics.js`; célzott tesztek: `tests/carousel-haptics.test.mjs`, `tests/carousel-haptics.browser.mjs`. A böngészőteszt a rezgés-API-t helyettesíti, így az időzítést és működést ellenőrzi; a valódi motor érzetét fizikai telefonon kell kipróbálni.

A fodrászválasztó ferde húzásnál a mozdulat elején választ irányt, és azt az elengedésig megtartja. Az oldalirányú húzás jelentős függőleges eltéréssel is a kártyákat mozgatja; a főleg függőleges mozdulat továbbra is az oldalt görgeti. A natív érintéskezelés megakadályozza, hogy a böngésző megszakítsa a ferde kártyahúzást, a kártyák érintési célpontjai pedig váltás közben is megmaradnak. A trackpad mozdulatsorai ugyanezt az irányrögzítést használják. Célzott ellenőrzések: `tests/carousel-gesture.test.mjs`, `tests/carousel-diagonal.browser.mjs`; a gyors pöccintés tesztjei az érintésmintákat folyamatosan küldik, így a böngésző válaszideje nem lassítja le mesterségesen a gesztust.

A rezgéses visszajelzés és a Rezgés/Haptics kapcsoló eltávolítva minden eszközön, Androidon is. A korábbi haptikus funkcióleírás és teszteredmények történeti állapotot dokumentálnak.
