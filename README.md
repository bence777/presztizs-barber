# DEMETERS – foglalási rendszer, 2026. november 26.

A foglaló valós Supabase-adatbázist és külön vendég-/kezelői azonosítást használ. Az alábbi új kiadási útmutató az irányadó; a dokumentum végén lévő prototípusleírás történeti előzmény.

## A frissítés tartalma

- Fodrászhoz kötött, szabadon létrehozható szolgáltatások: név, leírás, ár, pozitív egész percben megadott időtartam, sorrend, kikapcsolás és archiválás. A „Szolgáltatásaim” menü közvetlenül az adatbázist kezeli.
- „Saját beállítások”: megjelenített név, profilkép HTTPS-hivatkozással vagy meglévő helyi képpel, külön nyilvános telefonszám, kezdési lépésköz, alapértelmezett manuális szolgáltatás és heti munkaidősávok. A szabadságokat és szüneteket továbbra is a meglévő Szabadságok felület kezeli.
- Naptárból indított gyorsfoglalás: előválasztott fodrász/nap/kezdés/szolgáltatás; alaphelyzetben csak a vendég nevét kell beírni. A további beállítások lenyithatók, az időtartam felülírható. Telefon, e-mail és vendégfiók nem szükséges; e-mail nélkül az admin API nem indít értesítést.
- A nyilvános oldalon nincs dekoratív hero. Kompakt fodrászválasztó, kattintható körindikátorok, nyilvános `tel:` kapcsolat és fodrászonkénti aktív szolgáltatáslista jelenik meg. A várható összeg csak szolgáltatásválasztás után látszik. A magyar és angol szövegek támogatottak.
- A „Legkorábbi időpont” listájában minden szolgáltatás a konkrét fodrászához, árához és időtartamához tartozik; a rendszer nem helyettesíti egy másik fodrász azonos nevű szolgáltatásával. Ütközéskor ugyanahhoz a kiválasztott szolgáltatáshoz keres új időpontot.
- A naptáresemények magassága arányos a tényleges időtartammal, az egyidejű fodrászok külön oszlopokat kapnak. A kezdési lépésköz a foglalás hosszától független, a munkaidő kezdetétől számítódik.

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
