# DEMETERS – SEO és weboldalbővítés átadása

Állapot: 2026. november 27. A munka a meglévő Next.js Pages Router repositoryban készült. Production deploy és éles adatbázis-módosítás nem történt. A már meglévő munkakönyvtári módosítások megmaradtak.

## 1. Repository és kiinduló adatok

- Next.js 14.2.35, React 18; a Pages Router megmaradt.
- A vendég- és adminazonosítás külön cookie-kat, külön eszközjogosultságot és szerveroldali session-ellenőrzést használ. Ezeket a SEO-fejlesztés nem váltja le.
- A `booking_services` fodrászonkénti szolgáltatásokat, árakat, időtartamokat és archiválási állapotot tárol. A publikus árlista ugyanebből a katalógusból készül.
- A meglévő `private.managed_booking_staff()` RLS és az engedélyezett adminoszlopok határozzák meg a szerkesztési jogosultságokat. A nyilvános oldalak nem kaptak közvetlen anonim táblahozzáférést.
- A publikus csapat a meglévő foglalási katalógus hat kiválasztott fodrásza. A más célra fenntartott vagy korábban kivont adatbázisprofilokat nem tettem automatikusan foglalhatóvá. A csapat körének későbbi bővítése továbbra is a meglévő `data/team.mjs` és kapcsolódó szinkronfolyamat feladata.
- Csak olvasással ellenőrzött aktív szolgáltatások: Hajvágás, Gépi hajvágás, Haj és szakáll. A hat publikus fodrásznál a jelenlegi hajvágási tételek 5500 és 6000 Ft-osak, a kombinált szolgáltatás 8000 Ft. Ezek nincsenek beégetve az árlistába.
- Az önálló szakálligazítás inaktív; külön fade szolgáltatás nincs. Ezekhez jelenleg nem készül indexelhető oldal.
- A production domaint a tulajdonos erősítette meg: `https://demeters.hu`. Központi konfiguráció: `data/site.mjs`. A domain éles kiszolgálását ez a helyi fejlesztés nem igazolja.

## 2. Létrehozott és módosított fájlok

Az alábbi lista a SEO-fejlesztés saját változtatásait sorolja fel. A `git diff` más, már korábban folyamatban lévő módosításokat is tartalmazhat.

| Terület | Új fájlok | Módosított fájlok |
| --- | --- | --- |
| Központi SEO, tartalom, séma | `data/site.mjs`, `data/seoContent.mjs`, `lib/seo/catalog.mjs`, `lib/seo/schema.mjs`, `components/Seo.jsx` | — |
| Publikus adatbetöltés | `lib/server/publicCatalog.js`, `lib/server/publicPages.js` | — |
| Publikus megjelenés | `components/DemetersLogo.jsx`, `components/PublicLayout.jsx`, `components/EditorialPage.jsx`, `components/BarberDirectory.jsx`, `components/Faq.jsx`, `components/LocationSection.jsx`, `components/PortfolioGallery.jsx`, `components/PublicImage.jsx`, `styles/Editorial.module.css`, `public/images/demeters-logo.svg` | `pages/index.jsx`, `components/Services.jsx`, `components/BarberStack.jsx`, `components/BarberCarousel.jsx`, `components/SalonStory.jsx`, `components/TrustSection.jsx`, `components/BookingFooter.jsx` |
| Útvonalak és indexelés | `pages/en/index.jsx`, `pages/[...publicPath].jsx`, `pages/_document.jsx`, `pages/404.jsx`, `pages/sitemap.xml.jsx`, `pages/robots.txt.jsx`, `pages/api/og.jsx`, `middleware.js` | `next.config.js` |
| Nyelvváltás | — | `components/LanguageProvider.jsx`, `components/LanguageSwitcher.jsx`, `styles/LanguageSwitcher.module.css`, `pages/_app.jsx`, `data/team.mjs` |
| Foglalás és teljesítmény | `components/DeferredBooking.jsx` | `components/BookingWizard.jsx`, `components/HeroVideo.jsx`, `styles/globals.css` |
| Adminprofil és fordítások | `lib/server/publicProfileValidation.js`, `supabase/migrations/20261127105305_public_seo_profiles.sql` | `lib/server/staffSettings.js`, `components/AdminServices.jsx`, `pages/api/admin/settings.js`, `styles/AdminServices.module.css` |
| Analitika | `lib/client/analytics.mjs` | A foglaló, fodrászprofil, helyszín és telefonhivatkozások eseménypontjai |
| Ellenőrzés | `.eslintrc.json`, `tests/seo.test.mjs`, `tests/public-catalog.test.mjs`, `tests/analytics.test.mjs`, `tests/seo.browser.mjs`, `tests/fixtures/public-seo-fetch.cjs` | `tests/database.integration.mjs`, `tests/staff-services.test.mjs`, `tests/home-booking.browser.mjs`, `tests/public-booking.browser.mjs`, `tests/team-selection.browser.mjs`, `tests/staff-services.browser.mjs` |
| Konfiguráció és dokumentáció | `docs/seo-handoff.md` | `package.json`, `package-lock.json`, `.gitignore`, `README.md` |

A `pages/idopontfoglalas.jsx` korábban elkészült kompatibilitási átirányítását megőriztem. Az archívumot és a korábban szerkesztett adminnaptár-elrendezést ez a fejlesztés nem írta felül.

## 3. Elkészült SEO-fejlesztések

- Oldalanként egyedi title, description, tiszta canonical, robots, Open Graph, Twitter Card és JSON-LD; minden publikus metaadat a kezdeti HTML része.
- Saját magyar és angol URL-ek, szerveroldali tartalom, megfelelő HTML `lang`, kölcsönös `hu-HU` / `en` / `x-default` hivatkozások.
- A nyelvváltó az adott oldal megfelelő változatára vezet. A publikus nyelvet nem a localStorage határozza meg. Hiányzó angol profilbemutatkozás esetén az angol profilváltozat nincs publikálva.
- A régi `?lang=en` és `?lang=hu` publikus URL-ek 308-as átirányítást kapnak; a fodrász- és szolgáltatásválasztás paraméterei megmaradnak.
- A férfi fodrászat és férfi hajvágás azonos keresési szándéka egy erős szolgáltatási oldalon szerepel. A másik útvonal 308-as átirányítást kap.
- Valós, adatbázis-eredetű szolgáltatási oldalak; külön önálló szakálloldalt nem hoz létre pusztán egy kombinált szolgáltatás miatt. A hajfestés és más egyedi tételek az árlistán megmaradnak.
- A főoldali szolgáltatás-összesítő valós ársávokat mutat. A teljes árlista fodrászonkénti, időtartammal és előre kiválasztott fodrászhoz/szolgáltatáshoz vezető foglalási linkkel.
- A JSON-LD stabil üzleti, webhely-, személy-, szolgáltatás- és ajánlatazonosítókat használ. Csak rendelkezésre álló üzleti adatok kerülnek bele. Nincs kitalált cím, csillagérték, értékelésszám vagy AggregateRating.
- Akadálymentes natív `details` / `summary` FAQ; a válaszok JavaScript nélkül is a HTML-ben vannak, Enterrel és Space-szel kezelhetők.
- Crawler által követhető navigáció, kapcsolódó szolgáltatások, breadcrumb, lábléc, csapat és feltöltött profilok közötti linkek.
- Adatvezérelt galéria és ellenőrzött vendégvélemények előkészítve. Üres forrás esetén nem jelennek meg kitalált képek vagy vélemények.
- A nem létező vagy nem publikálható oldal valódi HTTP 404-et ad.
- A vendég-/adminoldalak és API-k noindex védelmet kapnak; a foglalási paraméteres URL-ek is `X-Robots-Tag: noindex` fejlécet kapnak. Az autentikáció továbbra is külön, tényleges szerveroldali védelem.
- Preview és más nem production host esetén a middleware noindex fejlécet ad. A robots engedi a beolvasást, hogy a robot lássa a noindexet; csak production host hirdet sitemapet. Preview környezetben a sitemap üres.
- A sitemapben nincs admin, API, vendégprofil, foglaláskezelési token vagy nem publikálható profil/szolgáltatás. Nem ír minden kérésnél hamis mai `lastmod` dátumot; a profilok valós publikus módosítási időpontját használja.

## 4. Publikus URL-ek

Az útvonalak a központi konfigurációban szerepelnek; nincs külön másolt árlista.

| Magyar | Angol | Állapot |
| --- | --- | --- |
| `/` | `/en` | Főoldal |
| `/arak` | `/en/prices` | Teljes árlista |
| `/fodraszok` | `/en/barbers` | Csapat |
| `/kapcsolat` | `/en/contact` | Kapcsolat |
| `/ferfi-hajvagas-debrecen` | `/en/mens-haircut-debrecen` | Az aktív hajvágási tételekből |
| `/haj-es-szakall-debrecen` | `/en/haircut-and-beard-debrecen` | Az aktív kombinált tételekből |
| `/szakallformazas-debrecen` | `/en/beard-trim-debrecen` | Jelenleg 404; önálló, aktív szakállszolgáltatás után jelenik meg |
| `/fade-hajvagas-debrecen` | `/en/fade-haircut-debrecen` | Jelenleg 404; kifejezett aktív fade szolgáltatás után jelenik meg |
| `/fodraszok/[slug]` | `/en/barbers/[slug]` | A publikálási feltételek teljesülése után |

További végpontok: `/sitemap.xml`, `/robots.txt`, `/api/og?lang=hu`, `/api/og?lang=en&page=prices`, `/api/og?lang=hu&page=profile&barber=[slug]`.

A `/ferfi-fodraszat-debrecen` a `/ferfi-hajvagas-debrecen` oldalra, az angol `/en/mens-hairdresser-debrecen` a `/en/mens-haircut-debrecen` oldalra irányít át.

## 5. Adatbázis-migráció és admin

Alkalmazandó fájl: `supabase/migrations/20261127105305_public_seo_profiles.sql`. A migráció a korábbi staff-services és eszközjogosultsági migrációkra épül. Helyi, elkülönített PostgreSQL-en ellenőrizve; éles Supabase-on még nem futott.

Új profilmezők a `booking_staff` táblában:

- `public_slug`, `bio`, `bio_en`;
- `specializations`, `specializations_en`;
- `portfolio` képhivatkozással, magyar és angol képleírással;
- `social_links` a nyilvános Instagram/Facebook/TikTok profilokhoz;
- `public_updated_at` valódi publikus profilváltozásokhoz.

Új szolgáltatásmezők: `name_en`, `description_en`. Üres fordításnál az ismert alapnevek fordítása használható, az egyedi név eredeti formában marad, ára és időtartama változatlanul valós adat.

A `booking_staff_slug_history` a régi URL-eket foglalja le. Az új slug egyedi; más fodrász korábbi slugja nem vehető át. A megjelenített név módosítása nem változtatja a slugot. Korábbi slugról közvetlen, végleges átirányítás vezet az aktuális címre, az inaktív/hiányos profil nem tér vissza.

A meglévő RLS-predikátumok megmaradnak. Az új mezőkhöz csak a szükséges oszlopjogok kerülnek hozzáadásra; az anon szerep nem kap olvasási vagy módosítási jogot. A profil-API a meglévő kezelői JWT-t és eszközazonosítót továbbítja. A trigger privát sémában van, rögzített `search_path` mellett; közvetlen meghívási joga visszavonva.

A Beállítások fülön szerkeszthető a két bemutatkozás, specializációk, slug, közösségi linkek és legfeljebb 24 saját portfóliókép. A szolgáltatásszerkesztő az angol nevet és leírást is kezeli. Az API hossz-, URL-, szolgáltató- és tulajdonosellenőrzést végez.

Publikálási feltétel: a meglévő aktív publikus foglalási katalógusban szereplő fodrász, stabil slug, legalább 40 karakteres saját magyar bemutatkozás és legalább egy aktív saját szolgáltatás. Az angol profilhoz legalább 40 karakteres angol bemutatkozás is kell. A migráció nem gyárt helyettük bemutatkozásokat.

A migráció előtti adatbázissal az oldal tovább működik: a valós árlista elérhető, az új profilmezők nem jelennek meg. Más adatbázishibát nem nyel el az ISR; hibánál a korábbi sikeres tartalom megmarad.

## 6. Cache, képek, teljesítmény és analitika

A főoldalak és a publikus tartalmi oldalak ISR-t használnak, 60 másodperces újraellenőrzéssel. Ez nem másolt árlista: az újragenerálás friss adatbázis-lekérdezést végez. Az első lejárat utáni kérés még kaphatja a korábbi oldalt, miközben a háttérben elkészül az új változat. A sitemap CDN-cache-e szintén 60 másodperc. Foglalási elérhetőséget ez a cache nem tárol.

A foglaló külön dinamikus JavaScript/CSS chunkokban van. A főoldal tetején nem mountolódik; a foglalási szekció közelében vagy foglalási deep linkre töltődik be. A csapatkártyák előválasztása, a visszaigazolás, az e-mailes azonosítás és az ütközéskezelés megmarad.

A hero megőrzi a meglévő videót és a 24 kB körüli posterét, `preload="none"` mellett. Reduced motion vagy adatforgalom-kímélő beállítás esetén a videóforrás nem kerül be a DOM-ba. Külön mobilvideó nem készült; a meglévő MP4 körülbelül 1,2 MB. A H1 és a CTA nem vár a videóra.

A helyi képek Next Image-ot, explicit képarányt/méreteket és reszponzív `sizes` értékeket kapnak; AVIF/WebP engedélyezve. A production feldolgozást a rögzített `sharp@0.35.5` támogatja. A külső, fodrász által megadott képek böngészőből, lazy módon töltődnek, hogy tetszőleges URL ne indíthasson szerveroldali kép-lekérést.

Az OG-végpont 1200 × 630 pixeles PNG-t készít, az eredeti DEMETERS SVG-logóval. Profilnál a fodrász nevét és – ha helyi vagy a projekt saját publikus Supabase Storage-képe – a saját portréját is használja. Nem támogatott vagy hiányzó kép esetén márkázott szöveges kép készül. Tetszőleges külső URL-t nem fetch-el a renderer.

A Next build szerinti First Load JS a főoldalakon körülbelül 177 kB, a publikus landing útvonalon körülbelül 114 kB. Ez buildadat, nem valós látogatói Core Web Vitals eredmény. Az LCP ≤ 2,5 s, INP ≤ 200 ms és CLS ≤ 0,1 célok 75. percentilisét éles terepadatok nélkül nem tekintjük elértnek.

Nincs meglévő analitikai tracker a repositoryban; új GA/Meta vagy párhuzamos tracker sem került telepítésre. A következő eseménypontok elkészültek: `booking_started`, `barber_selected`, `service_selected`, `booking_completed`, `phone_clicked`, `directions_clicked`, `barber_profile_viewed`.

A `lib/client/analytics.mjs` csak kifejezett `setAnalyticsConsent(true)` után bocsát ki `demeters:analytics` CustomEventet. Alapból nem mér, nem küld hálózati kérést, nem queue-zik és nem ír cookie-t. A később választott, hozzájáruláshoz kötött mérőrendszer ezt az eseményt fogadhatja. A megengedett mezők csak publikus szolgáltatás-/fodrászazonosító, nyelv és eseményelhelyezés; nincs e-mail, telefon, foglalási azonosító, token vagy query string. Az adapternek is tiszta page location/referrer adatot kell használnia. A `booking_completed` csak sikeres, foglalásazonosítót visszaadó API-válasz után fut.

## 7. Környezeti változók és éles aktiválás

Új kötelező környezeti változó nincs. A meglévő szerveroldali Supabase- és session-beállítások maradnak. A `VERCEL_ENV` értékét a Vercel biztosítja; preview esetén nem lehet `production`.

A foglalási e-mailek meglévő `SITE_URL` / `NEXT_PUBLIC_SITE_URL` beállítását productionban `https://demeters.hu` értékre kell állítani. A helyi `.env.local` localhost értékét nem módosítottam. A titkos Supabase-kulcs továbbra sem `NEXT_PUBLIC_` változó.

Élesítés előtt:

1. A migrációt a meglévő migrációs folyamattal alkalmazni, előbb tesztkörnyezetben.
2. Az admin Beállításokban feltölteni a fodrászok valós, jóváhagyott bemutatkozását, portréit, specializációit és portfólióját. A szolgáltatásokhoz szükség szerint angol fordításokat megadni.
3. A `data/site.mjs` üres üzleti mezőit ellenőrzött adatokkal feltölteni.
4. Production URL / e-mail-link beállításokat és Vercel környezetet ellenőrizni.
5. Jóváhagyott production deploy után ellenőrizni az éles canonicalokat, noindex hiányát a publikus tartalmon, a robotsot, sitemapet és egy tesztfoglalást a tulajdonos által kijelölt módon.

## 8. Hiányzó üzleti adatok és ismert korlátok

- Pontos utcacím, irányítószám, városrész és koordináták.
- Szalonhoz tartozó publikus telefon és e-mail. Privát belépési/értesítési e-mailt nem használtam helyettük.
- Ellenőrzött szalonnyitvatartás. Az egyes fodrászok foglalási munkaidejét nem azonosítottam automatikusan a szalon nyitvatartásával.
- Google Cégprofil és útvonaltervezési URL; parkolási és tömegközlekedési információk.
- Jóváhagyott valódi belső szalonfotók, munkafotók, vendégvélemények, illetve publikus üzleti közösségi oldalak.
- A hat publikus fodrász adatbázisprofiljában jelenleg nincs saját portré vagy bemutatkozás. Emiatt az új egyéni profilok még nem kerülnek a valódi sitemapbe. A rendszer és az adminfelület elkészült, de a tartalmat a fodrászoknak kell megadniuk.
- A meglévő szalontörténet nagy belső képe továbbra is kifejezetten hangulatképként jelölt stockhelyőrző. Nem szerepel valódi szalonfotóként a strukturált adatokban.
- Angol nyelvű személyes kommunikációt, nem igazolt specializációt vagy pontos helyszíni megközelítést nem állítottam.
- A lokáció a pontos cím megadásáig csak a bizonyított Debrecen várost tudja közölni. Google Maps iframe nem terheli az első betöltést; a közvetlen útvonaltervezési link az adat megadásakor jelenik meg.
- Hét lint warning maradt a meglévő foglalási/azonosítási hookok és az admin kép-előnézet körül; lint error nincs. A meglévő teljes dokumentumnavigációt használó privát oldalak külön ESLint-kivételt kaptak a Next Link szabály alól, hogy az autentikációs határok viselkedése megmaradjon.
- A böngészős üzleti műveletek mock API-kkal futottak. Az éles e-mail-kézbesítés, production sessionök és valós időpont létrehozása nem volt ennek a helyi QA-nak része.

## 9. Ellenőrzés és reprodukálás

Végleges eredmények:

| Ellenőrzés | Eredmény |
| --- | --- |
| Production build a tényleges, csak olvasott Supabase-katalógussal | Sikeres |
| `npm run lint` | Sikeres; 0 error, 7 warning |
| `npm test` | 105/105 sikeres |
| Eldobható helyi PostgreSQL és új migráció | 54/54 sikeres |
| Főoldali foglalás / public foglalás / saját szolgáltatások és profil / csapatválasztás / legkorábbi időpont / staff isolation / adminnaptár / reszponzív admin | 16 + 14 + 8 + 15 + 10 + 6 + 25 + 35 = 129 sikeres ellenőrzés |
| Külön SEO browser suite | 11 sikeres csoport: 14 HU/EN oldal kezdeti HTML-je, 16 fixture sitemap-URL, 24 reszponzív oldalnézet és kapcsolódó ellenőrzések |
| Külön preview mód és autentikáció | 5 noindex/robots/sitemap és 3 privát API 401 ellenőrzés |
| `git diff --check` | Tiszta |
| Publikus JS chunkok szerveroldali titkos konfigurációra vizsgálva | Nincs Supabase secret/session signing változó a kliens chunkokban |

A 16 sitemap-URL tesztfixture-eredmény, feltöltött tesztprofilokkal. Az éles adatbázis jelenlegi, üres bemutatkozású profiljai nem kerülnek a valódi sitemapbe.

A tesztadatok csak a külön `NODE_OPTIONS=--require=./tests/fixtures/public-seo-fetch.cjs` kapcsolóval töltődnek be. Ezt production környezetben nem szabad beállítani. A fixture minden adatbázis-írást tilt.

```sh
npm ci
npm run lint
npm test
DEMETERS_BUILD_DIR=.next-seo-qa npm run build

# Eldobható helyi PostgreSQL; nem olvassa az .env fájlt.
DEMETERS_QA_MODULES=/path/to/postgres-qa npm run test:db

# SSR-t és kliensoldali működést együtt tesztelő elkülönített fixture build.
NODE_OPTIONS=--require=./tests/fixtures/public-seo-fetch.cjs DEMETERS_BUILD_DIR=.next-seo-fixture npm run build
NODE_OPTIONS=--require=./tests/fixtures/public-seo-fetch.cjs DEMETERS_BUILD_DIR=.next-seo-fixture npm run start -- -p 3112

# Másik terminálban; Playwright telepítést tartalmazó QA-könyvtárral.
DEMETERS_QA_MODULES=/path/to/browser-qa DEMETERS_PREVIEW_URL=http://127.0.0.1:3112 npm run test:seo
```

A browser QA szükség esetén a `DEMETERS_BROWSER` változóban megadott telepített Chromium-alapú böngészőt használja. A megjelenést 320, 390, 768 és 1440 px-en, a foglalási teszteket további 375 px-en is ellenőrzi. Képernyőképek és OG-minták helyi QA-kimenete: `/private/tmp/demeters-qa/seo`.

Ellenőrzött: a kezdeti HTML-ben lévő árak és FAQ, egyedi metaadatok, kölcsönös hreflang, valódi 404/308 státuszok, sitemap URL-ek, privát és paraméteres noindex, 1200 × 630 PNG-k, billentyűzetes FAQ, reduced motion, horizontális túlcsordulás hiánya, teljes foglalási folyamat és ütközéskezelés, saját szolgáltatások, saját profil és portfólió, admin/fodrász RLS és slugütközések, érzékeny mezők kizárása.

## 10. Google Search Console teendők

1. A `demeters.hu` domain tulajdonjogának igazolása DNS TXT rekorddal, ha még nincs meg.
2. Csak az élesítés után a `https://demeters.hu/sitemap.xml` beküldése.
3. URL Inspection az éles magyar és angol főoldalon, árlistán, hajvágás/kombinált oldalon és az első ténylegesen feltöltött fodrászprofilon. Ellenőrizni a Google által választott canonicalt és a renderelt tartalmat.
4. Strukturált adatok ellenőrzése a Schema Markup Validatorral, a Google által támogatott elemekhez Rich Results Testtel. A séma megléte nem jelent garantált rich resultot; saját vállalkozásértékelésből nem készül AggregateRating.
5. Az Indexing jelentésben megfigyelni az esetleges 404-eket, átirányításokat, duplikált canonicalokat és véletlen noindexet. A jelenleg nem kínált fade/önálló szakáll oldalak 404-e szándékos, sitemapben nincsenek.
6. Performance jelentésben figyelni a debreceni magyar és angol kereséseket, a CTR-t és a céloldalakat. Az analitikai adapter hozzájárulásos bekötése után az organikus foglalások arányát is mérni.
7. Core Web Vitals jelentésben valós látogatói adatok alapján értékelni az LCP/INP/CLS 75. percentilisét. A helyi build és a funkcionális browser teszt nem helyettesíti ezt.
8. Google Cégprofilon ugyanazt a nevet, címet, telefont, nyitvatartást és foglalási URL-t használni, mint a webhely ellenőrzött üzleti konfigurációjában.

Technikai háttér: [Next.js Pages Router i18n](https://nextjs.org/docs/pages/guides/internationalization), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). A megvalósítás explicit lokalizált útvonalakat használ a meglévő Pages Routerben.
