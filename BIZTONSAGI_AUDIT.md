# DEMETERS – biztonsági és működési audit

**Dátum:** 2026. november 27. (Europe/Budapest)  
**Vizsgált forrásállapot:** `c47e324` – a vizsgálat kezdetén tiszta munkakönyvtár.  
**Eredmény:** vannak jól működő védelmek, de a projektet jelen állapotában még nem tekinteném kellően megerősítettnek üzemszerű, személyes adatokat kezelő szolgáltatáshoz. A legfontosabb teendő a támogatott függőségekre váltás, a visszaélések korlátozása és az adminhitelesítés megerősítése.

**Ez állapotfelmérés és javítási terv.** Az audit során az alkalmazáskódot, éles beállításokat és adatokat nem módosítottam. Kizárólag ezt a jelentést adtam a projekthez. Bizonyított jogosulatlan hozzáférést más vendég vagy más fodrász foglalásaihoz nem találtam. Ez nem jelent teljes körű sérthetetlenségi garanciát.

## 1. Hatókör és bizonyítékok

Átvizsgált területek:

- Next.js Pages Router oldalak, middleware, API-végpontok és biztonsági fejlécek.
- Vendég- és adminbelépés, OTP, jelszavas belépés, cookie-k, eszköznyilvántartás, visszavonás és munkamenet-hosszabbítás.
- Foglalás, lemondás, manuális és ismétlődő foglalások, naptár, távollétek, szolgáltatások és dolgozói fiókok kezelése.
- Supabase-migrációk, RLS, GRANT-ok, függvényjogosultságok, triggeres védelem és konkurens mentések.
- Nyilvános profilok, képek, SEO/JSON-LD, e-mailek, titokkezelés, kliensoldali adattárolás és npm-függőségek.
- A mellékelt adatbázisséma, a Gitben követett fájlok, az `Archívum.zip` és célzott mintakeresés a helyi Git-előzményekben.

**Az éles Supabase-projektet is ellenőriztem, csak olvasással:** a helyi konfigurációhoz tartozó `presztizs-barber` projektben lekérdeztem a táblák RLS-állapotát, policy-kat, hozzáférési engedélyeket, fontos függvénydefiníciókat, constraint-eket, migrációs nyilvántartást, Storage-inventárt és Cron-jobok metaadatait. Lefutott a Supabase Security Advisor is. Vendégrekordokat, jelszóhasheket, tokeneket és privát e-maileket nem exportáltam.

Az API-próbák helyi production builden, elkülönített tesztadatokkal futottak. Nem küldtem valódi OTP-t vagy e-mailt, és nem hoztam létre éles foglalást. Az éles `demeters.hu` deployment verzióját, Vercel WAF-szabályait, DNS/TLS-beállításait és az összes Auth Dashboard-beállítást nem ellenőriztem. A helyi build sikeressége nem igazolja ezeket.

### Ellenőrzések eredménye

| Ellenőrzés | Eredmény | Mit bizonyít / korlát |
| --- | --- | --- |
| `npm test` | **113/113 sikeres** | A meglévő egységtesztek rendben; nem teljes behatolásteszt. |
| Elkülönített PostgreSQL-integráció | **54/54 sikeres** | Valódi helyi Postgresen migrációk, RLS, elkülönítés, ütközések, visszavonás és profiljogosultságok. |
| Helyi HTTP-biztonsági próbák | **16/16 sikeres** | Jogosulatlan olvasások, hibás eredetű módosítások, metódusok, dátumkorlát és fejlécek. |
| Párhuzamos adminszerkesztés célzott próbája | **Hiba reprodukálva** | Két sikeres mentésből az utolsó felülírja az elsőt; lásd SEC-06. |
| `npm run lint` | **0 hiba, 7 figyelmeztetés** | Főleg React Hook-függőségek és egy képhasználati figyelmeztetés. |
| Production build tesztadatokkal | **Sikeres** | `NODE_OPTIONS=--require=./tests/fixtures/public-seo-fetch.cjs DEMETERS_BUILD_DIR=.next-seo-fixture npm run build`. |
| Teljes `npm audit` | **6 érintett csomag** | 1 critical, 4 high, 1 moderate csomagszintű besorolás; nem hat külön bizonyított támadás. |
| `npm audit --omit=dev` | **2 érintett csomag** | `next`: critical, `postcss`: high; a tényleges kihasználhatóság feltételfüggő. |

**Besorolás:** „bizonyított” = kóddal, élő konfigurációval vagy célzott próbával igazolt állapot. „Megerősítendő védelem” = hiányzó biztonsági réteg, nem bizonyított behatolás. „Feltételes” = további körülmény szükséges a kihasználásához. P1: első javítási kör; P2: következő megerősítési kör; P3: alacsonyabb kockázat / feltételes probléma.

## 2. Fontossági sorrend

| Azonosító | Súlyosság / prioritás | Megállapítás | Bizonyosság |
| --- | --- | --- | --- |
| SEC-01 | Magas / P1 | Nem támogatott Next.js, ismert függőségi riasztások | Verziók bizonyítottak; támadási utak feltételesek |
| SEC-02 | Magas / P1 | Nincs alkalmazásszintű, elosztott sebesség- és foglalási kvótavédelem | Forrásból igazolt hiány; WAF ismeretlen |
| SEC-03 | Magas / P1 | Az adminműveletekhez nincs kikényszerített második faktor / friss újrahitelesítés | Megerősítendő védelem |
| SEC-04 | Közepes / P1 | Az éles kiszivárgottjelszó-védelem ki van kapcsolva | Éles Security Advisor igazolta |
| SEC-05 | Közepes / P2 | Túl tartós adminmunkamenetek és hiányos végleges visszavonási folyamat | Kódból igazolt; Auth-szolgáltatói korlátok nem teljesen ismertek |
| SEC-06 | Közepes / P2 | Párhuzamos szerkesztések csendes adatfelülírása | Reprodukált működési hiba |
| SEC-07 | Közepes / P2 | A forrás és az éles séma / migrációs nyilvántartás eltér | Élő metaadatok igazolták |
| SEC-08 | Közepes / P2 | Hiányzó Content Security Policy | Kód és helyi HTTP-válasz igazolta |
| SEC-09 | Közepes / P2 | A legtöbb külső kérésnek nincs alkalmazás által meghatározott időkorlátja | Kódból igazolt rendelkezésre állási kockázat |
| SEC-10 | Közepes / P2 | Foglalásmentéshez nem tartozik tartós értesítési sor és idempotenciakulcs | Kódból igazolt működési hiány |
| SEC-11 | Közepes / P2 | Nincs üzleti, visszakövethető admin-auditnapló | A projektben és a vizsgált alkalmazássémákban nincs ilyen megoldás |
| SEC-12 | Alacsony / P3 | OG-kép letöltési méretkorlátja csak a teljes letöltés után érvényesül | Feltételes; jelenleg nincs Storage bucket |
| SEC-13 | Alacsony / P3 | Admin-OTP küldésből következtetni lehet az aktív kezelői címekre | Kódból levezethető válaszkülönbség |

**Nem azonosítottam bizonyított kritikus alkalmazásszintű behatolási utat.** Az npm „critical” jelölése a telepített csomaghoz tartozó közlemények legmagasabb besorolása; nem bizonyítja, hogy ezen a deploymenten távoli kódfuttatás lehetséges.

## 3. Részletes megállapítások

### SEC-01 – támogatáson kívüli keretrendszer és sérülékenységi riasztások

**Bizonyíték:** [package.json](package.json), [package-lock.json](package-lock.json), [next.config.js](next.config.js#L5). A feloldott verzió `next@14.2.35`, `react@18.3.1`, `react-dom@18.3.1`, `postcss@8.4.31`, `glob@10.3.10`; a glob alatti minimatch `9.0.9`. A közvetlen `sharp` verzió **0.35.5**, és a Next képfeldolgozója is ezt oldja fel. A Next.js 14 már nem támogatott a gyártó jelenlegi [támogatási szabályzata](https://nextjs.org/support-policy) szerint.

**Értelmezés, a téves riasztások elkerülésére:**

- A [SVG-képfeldolgozási közlemény](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) megadott kerülőmegoldása `sharp >= 0.35.5`; ezt a projekt már teljesíti. Ebből a közleményből önmagában nem állítható aktív RCE-rés.
- Az [AVIF-képfeldolgozási közlemény](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) további ellenőrzést indokol a tényleges éles képfeldolgozó-környezetben. A konfiguráció AVIF kimenetet enged, de ez önmagában nem bizonyít rosszindulatú AVIF-bemenethez vezető utat.
- A [Windows RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) Windows fájlrendszerű szerverre vonatkozik. Vercelre utaló konfiguráció mellett sem bizonyíték arra, hogy ez az éles hosting érintett.
- Az App Router / RSC / Server Actions közleményeknél a projekt **Pages Router** használata lényeges; nem tekinthetők automatikusan alkalmazható támadási útnak. A middleware itt nem hitelesítési határ: az API-k külön ellenőrzik a jogosultságot.
- A fejlesztési függőségek glob-parancsinjektálási riasztása feltételes, például veszélyes CLI-használatot igényel. Nem találtam olyan projektkódot, amely vendégbemenetet ilyen shell-parancsba épít.
- A PostCSS-riasztásoknál nem találtam felhasználó által beküldött CSS-feldolgozási funkciót. A sérülékeny verzió ettől még frissítendő.

**Javítás:** tervezett migráció támogatott, friss stabil Next.js-verzióra, hozzá illő React/React DOM és lintkonfiguráció mellett. A jelenlegi támogatási cél a 16-os ág; a 15-ös ág támogatása a gyártó szerint 2027. január 31-ig hosszabbított. Az átállás tartalmazza a build/lint-parancsok és az OG-képek ellenőrzését is. A zárfájlt frissíteni kell; az `npm audit fix --force` vak futtatása nem megfelelő kiadási eljárás.

**Elfogadási feltétel:** friss audit, tiszta reprodukálható telepítés, sikeres foglalási/admin/SEO tesztek és az éles futtatókörnyezet képfeldolgozó-verzióinak ellenőrzése. A fennmaradó riasztásokhoz dokumentált alkalmazhatósági döntés szükséges.

### SEC-02 – hiányzó visszaélés-korlátozás

**Érintett:** `pages/api/guest/{send-code,verify-code}.js`, `pages/api/admin/auth/{send-code,verify-code,password}.js`, `pages/api/booking/{availability,earliest,create}.js`, [bookingDb.js](lib/server/bookingDb.js#L138).

**Mi hiányzik:** nincs közös, több szerverpéldány között működő rate limiter; a belépés leginkább a Supabase `429` válaszát továbbítja. Nincs saját CAPTCHA-ellenőrzés, felhasználónkénti aktívfoglalás-kvóta vagy a drága szabadidőpont-keresések közös korlátja. Egy hitelesített vendég több, egymással nem ütköző jövőbeli időpontot is lefoglalhat; az ütközésvédelem nem foglalási darabszámkorlát.

**Kockázat:** OTP/e-mail-kvóta kimerítése, jelszópróbálgatás, naptárfeltöltés és sok adatbázis-műveletet indító nyilvános kérések. Az availability és earliest lekérdezés havi ismétlések materializálását is elindíthatja; nem egyszerű statikus olvasás. Az Origin-ellenőrzés a böngészős CSRF ellen jó, de automatizált kliens saját Origin fejlécet küldhet. A Supabase saját [Auth-korlátai](https://supabase.com/docs/guides/auth/rate-limits) hasznosak, de nem fedik le az összes foglalási műveletet. Vercel WAF-ban lehet további védelem; ezt nem láttam.

**Javítás:** atomikus, megosztott korlátok megbízható proxyból származó IP, normalizált cím és hitelesített user szerint; fokozatos késleltetés; botvédelem az OTP-küldésnél; külön költségkeret a keresésre. A foglalási kvótát tranzakcióban kell kikényszeríteni, különben párhuzamos kérések megkerülhetik. Például 3 aktív jövőbeli foglalás/fő lehet induló üzleti szabály, a szalon jóváhagyásával.

**Elfogadási feltétel:** több szerverpéldányt utánzó, párhuzamos próbákban a küszöb felett `429`; két párhuzamos foglalás sem lépheti túl a kvótát. Ne legyen könnyű egyetlen célzott e-mail-cím teljes szolgáltatását tartósan letiltani.

### SEC-03 – nincs kikényszerített MFA és érzékeny műveleti újrahitelesítés

**Bizonyíték:** [admin OTP ellenőrzése](pages/api/admin/auth/verify-code.js), [jelszavas belépés](lib/server/staffAccounts.js#L121), [admin munkamenet](lib/server/adminAuth.js#L58), [jogosultságkeresés](supabase/migrations/20261126103730_isolated_staff_sliding_devices.sql#L4). Nincs másodikfaktor-challenge, `aal2` kikényszerítés vagy a belépés frissességének ellenőrzése fiókkezelés és végleges törlés előtt.

**Kockázat:** a főadminpostafiók kompromittálása önmagában elég lehet az OTP-s belépéshez; fodrásznál a jelszó ellopása is elegendő lehet. Az eszköz-cookie hasznos munkamenetvédelem, de a belépés során kiadott tokenként nem független második faktor.

**Javítás:** főadminnak kötelező, fodrásznak is javasolt MFA; főadmin-fiókkezeléshez, jogosultságváltoztatáshoz és veszélyes törléshez friss újrahitelesítés. A korlátot szerveren és – ahol közvetlen DB-hozzáférés van – az adatbázis jogosultsági függvényében is érvényesíteni kell. Pusztán egy UI-lépés nem védelem. [Supabase MFA dokumentáció](https://supabase.com/docs/guides/auth/auth-mfa).

**Elfogadási feltétel:** második faktor nélkül az érzékeny API/RPC-művelet elutasított, érvényes első faktorral és meglévő eszköz-cookie-val is. Legyen tesztelt helyreállítási folyamat.

### SEC-04 – éles kiszivárgottjelszó-védelem kikapcsolva

**Bizonyíték:** a Supabase Security Advisor `auth_leaked_password_protection` figyelmeztetést adott: **Leaked Password Protection Disabled**. Ez tényleges éles beállítás, nem kódból feltételezett hiány. A projektben van használható jelszavas fodrászbelépés.

**Kockázat:** az ismert adatszivárgásokban szereplő jelszavak elfogadhatók lehetnek. A helyi kezdőjelszó-hosszellenőrzés nem helyettesíti a szolgáltató globális szabályait.

**Javítás:** a szolgáltatási csomag lehetőségei szerint bekapcsolni a kiszivárgottjelszó-védelmet; ellenőrizni a Supabase minimális jelszóhosszát és a biztonságos jelszócsere beállításait. A dokumentáció szerint a kiszivárgottjelszó-védelem Pro csomagtól elérhető; csomagváltást az audit nem végzett. [Hivatalos javítási útmutató](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Elfogadási feltétel:** Advisor-figyelmeztetés megszűnik, és külön tesztfiókkal ellenőrzött a jelszópolitika. Az MFA és a rate limit ettől függetlenül szükséges.

### SEC-05 – adminmunkamenetek túl hosszú életciklusa és visszavonási hiányok

**Bizonyíték:** [adminAuth.js](lib/server/adminAuth.js#L91), [guestAuth.js](lib/server/guestAuth.js#L124), [eszközhosszabbító RPC](supabase/migrations/20261126103730_isolated_staff_sliding_devices.sql#L23), [fiók letiltása](lib/server/staffAccounts.js#L104), [eszköz eltávolítása](lib/server/deviceApi.js#L34).

- A megjegyzett adminmunkamenet 7 napos, a vendégé 60 napos **gördülő** élettartamú. Az alkalmazásban nincs külön abszolút felső korlát; a rendszeres használat folyamatosan kitolhatja a lejáratot. A Supabase saját időkorlátai ezt kívülről szűkíthetik, beállításukat nem ellenőriztem.
- Az admin-eszközhosszabbítás a `getAdmin()` hívásában történik, a `managerFor()` aktív kezelői ellenőrzése előtt. Emiatt a már letiltott kezelő érvényes Auth- és eszközadataival is megpróbálható a munkamenet életben tartása, miközben a tényleges adminművelet helyesen `403`-at kap.
- Az `active:false` beállítás nem törli az admineszközöket. Visszaaktiváláskor a korábbi, még érvényes munkamenet új belépés nélkül ismét használható lehet.
- Másik eszköz eltávolításakor a saját eszköztábla sora törlődik, de a távoli Supabase Auth-session külön visszavonása nincs megvalósítva; a szolgáltatói logout csak az aktuális eszköz ágában fut. A táblában nincs Auth `session_id` kötés.

**Fontos korlát:** a törölt eszköz alkalmazás- és staff-RLS-hozzáférése jelenleg helyesen megszűnik. Az éles `guest_profiles` táblára az `authenticated` szerepnek sincs közvetlen GRANT-ja. Nem állítom, hogy távoli eszköz törlése után tovább olvashatók a vendégadatok; a maradó Auth-tokenek szolgáltatói képességeit külön kell ellenőrizni.

**Javítás:** abszolút session-határ és érdemi inaktivitási korlát adminoknál; jogosultság ellenőrzése a hosszabbítás előtt; letiltáskor az admineszközök visszavonása; Auth-session és saját eszköz összekötése. A szolgáltatói session-visszavonás mellett a kritikus műveletek tartsák meg az azonnali DB-eszközellenőrzést. [Supabase session-életciklus](https://supabase.com/docs/guides/auth/sessions).

**Elfogadási feltétel:** letiltás → próbált hosszabbítás → visszaaktiválás után a régi cookie-k nem használhatók; új hitelesítés szükséges. Távoli visszavonás után a szolgáltatói refresh és a saját API-k is a dokumentált korlát szerint legyenek elutasítva.

### SEC-06 – párhuzamos mentésnél elveszhet egy módosítás

**Bizonyíték:** [editAdminAppointment](lib/server/adminCalendar.js#L123). A mentés előbb beolvassa a foglalást, majd csak `id` és szükség esetén `staff_id` alapján PATCH-el. Nincs rekordverzió vagy eredeti módosítási idő a feltételben. A `rows.length !== 1` ellenőrzés csak az eltűnt rekordot érzékeli, egy közben megváltoztatott rekordot nem.

**Reprodukció:** elkülönített, teljesen mockolt kérésekkel ugyanazt az eredeti rekordot olvastam be két szerkesztőnek. „Editor A” és „Editor B” mentése is sikeres lett; a végső rekordban „Editor B” szerepelt, konfliktusjelzés nélkül. Ez adatvesztési működési hiba, nem másik fodrász adataihoz vezető jogosultsági rés. Más adminmutációknál is vizsgálandó ugyanez a minta.

**Javítás:** adatbázisban növelt `revision` mező vagy megbízható `updated_at`, feltételes UPDATE / tranzakciós RPC, elavult verziónál `409 Conflict`. A kliens mutassa a friss adatot, ne mentse automatikusan rá a régi űrlapot.

**Elfogadási feltétel:** ugyanabból a rekordverzióból induló két párhuzamos módosítás közül legfeljebb egy sikeres; a másik konfliktust jelez.

### SEC-07 – eltérés az éles séma és a forrás között

**Bizonyíték:** [nyilvános profil migráció](supabase/migrations/20261127105305_public_seo_profiles.sql), [kompatibilitási fallback](lib/server/publicCatalog.js#L11). Az éles adatbázisból lekért profilmezők (`public_slug`, `bio`, `bio_en`, `portfolio`, `social_links`, `public_updated_at`) és a szolgáltatások `name_en`, `description_en` mezői nem voltak jelen. Az éles migrációs naplóban sem szerepelt a `20261127105305` migráció.

Egyes más, helyben migrációként tárolt változások definíciói jelen vannak élesen, miközben azonos nevű/verziójú migrációs bejegyzésük hiányzik. Ez nyilvántartási eltérés; **nem bizonyítja az adott védelem hiányát**. A fontos éles RLS- és guard-függvények definícióit külön is ellenőriztem.

**Hatás:** az új profilokhoz/fordításokhoz tartozó képességek részben fallbackre állnak vagy mentéskor hibáznak; a `profilesReady:false` állapot mellett a késznek hitt profiloldalak nem feltétlenül érhetők el. A helyi fixture-build ezt elfedi, mert a fixture tartalmazza a hiányzó mezőket. Későbbi vak migrációfuttatás „már létező objektum” hibákat is okozhat.

**Javítás:** az éles séma és migrációtörténet egyeztetése, mentés és staging-próba után. A már létező objektumokra ne fusson rá ellenőrzés nélkül ugyanaz a DDL. A hiányzó SEO-migrációt célzottan, ellenőrzött kiadásként kell alkalmazni; az audit ezt nem futtatta.

**Elfogadási feltétel:** a mezők és GRANT-ok ténylegesen jelen vannak, `profilesReady:true`, saját profil menthető, idegen profil nem; a migrációs napló és a séma megfelel a kiadott forrásnak.

### SEC-08 – hiányzó Content Security Policy

**Bizonyíték:** [next.config.js](next.config.js#L12); a helyi production oldal válaszában nincs `Content-Security-Policy`. A többi vizsgált fejléc – `nosniff`, `DENY`, `no-referrer`, Permissions Policy, COOP és HSTS – jelen van.

**Kockázat:** egy később bekerülő XSS-hiba vagy kompromittált script hatását kevesebb böngészőoldali korlát szűkíti. Jelen vizsgálat nem talált bizonyított XSS-injektálási utat; a CSP védelmi réteg hiánya önmagában nem bizonyít XSS-t.

**Javítás:** a Pages Router és ISR működéséhez illeszkedő CSP először Report-Only módban, majd kikényszerítve. Kiindulás: `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, szűk `connect-src`, kép- és médiadomain-lista. A scriptengedélyeket a tényleges Next.js-inline scriptekhez, JSON-LD-hez és a renderelési módhoz kell kialakítani; a Framer Motion miatt a stíluskezelést is tesztelni kell. Ne kerüljön be végleges megoldásként korlátlan `script-src * 'unsafe-inline'`.

**Elfogadási feltétel:** idegen script futása tiltott, de a nyelvváltás, booking, adminnaptár, animációk és strukturált adatok működnek; az éles fejléc is ellenőrzött.

### SEC-09 – nincsenek tudatos külsőhívás-időkorlátok

**Bizonyíték:** [Supabase Auth-kérés](lib/server/guestAuth.js#L51), [adatbázis-kérés](lib/server/bookingDb.js#L77), [Auth-admin kérés](lib/server/staffAccounts.js#L26), [Resend-kérés](lib/server/bookingEmail.js#L62). Ezeken nincs alkalmazás által beállított `AbortSignal`/határidő. Az OG-portré külön, pozitív kivétel: ott 4 másodperces timeout van.

**Kockázat:** lassú szolgáltató hosszabb ideig foglalja a kéréseket; a hosting végső timeoutja előtt nem feltétlenül marad idő konzisztens hibaválaszra. Mentés után elakadó értesítésnél a kliens tévesen sikertelennek érzékelhet egy már rögzített foglalást.

**Javítás:** hívásonkénti és teljes kérésre vonatkozó időkeret; célzott hibakódok. Automatikus retry csak biztonságosan ismételhető olvasásra vagy idempotenciával védett módosításra. Megszakítás nem bizonyítja, hogy a távoli tranzakció nem futott le.

**Elfogadási feltétel:** lassú / nem válaszoló tesztszolgáltató mellett is korlátos válaszidő; bizonytalan mentésnél az eredmény visszakereshető és nem jön létre duplikáció.

### SEC-10 – nincs tartós értesítési outbox és kérésazonosítás

**Bizonyíték:** [foglalás létrehozása](pages/api/booking/create.js#L15), [e-mail-küldés](lib/server/bookingEmail.js#L52). A DB-mentést közvetlen e-mail-küldés követi; hiba esetén log és `emailSent:false` van. Nincs tartós küldési sor, kézbesítési állapot, automatikus újrapróbálás vagy foglalási idempotenciakulcs. Hasonló a módosítási és lemondási értesítések útja.

**Hatás:** szolgáltatói hiba / folyamatleállás után egy mentett foglalás értesítése végleg elmaradhat. Ismételt, azonos kéréskor a jelenlegi ütközésvédelem rendszerint helyesen megakadályozza ugyanazt a foglalást, de a kliens `409`-et kaphat a korábbi siker visszaadása helyett. Ez nem bizonyított dupla foglalás.

**Javítás:** booking + értesítési feladat egy adatbázis-tranzakcióban, deduplikált outbox-feldolgozó, korlátozott újrapróbálás és riasztás. Felhasználóhoz kötött idempotenciakulcs és payload-ellenőrzés; ugyanaz a kérés ugyanazt az eredményt adja vissza. A foglalás állapota legyen elsődleges, az e-mail kézbesítése külön követhető.

**Elfogadási feltétel:** leállítás közvetlenül a DB-commit után sem veszít értesítést; azonos kulcsos párhuzamos kérésekből egy foglalás és egy logikai értesítési esemény keletkezik.

### SEC-11 – hiányzó üzleti auditnapló

**Bizonyíték:** az API-k és a vizsgált alkalmazássémák nem tartalmaznak olyan naplót, amely foglalásmódosításnál, végleges törlésnél, jogosultságváltoztatásnál és eszközvisszavonásnál rögzítené az eljáró személyt, célt és változást. A `console.error` és a szolgáltatói általános/Auth log nem helyettesíti ezt. Külső, külön konfigurált üzleti napló meglétét nem igazoltam.

**Kockázat:** téves vagy szándékos módosítás után nehezebb rekonstruálni, ki mit csinált. A foglalások végleges DELETE-je és az éles `booking_appointments.user_id → auth.users.id ON DELETE CASCADE` miatt egy Auth-fiók adminisztratív törlése foglalási előzményeket is eltávolíthat. Utóbbi az élő constraint-ből igazolt viselkedés, jelenleg nem publikus fióktörlési API.

**Javítás:** külön, alkalmazásfelhasználó által nem módosítható auditcsatorna, request ID-val és minimális szükséges adatokkal. Ne naplózzon OTP-t, jelszót, tokent vagy indokolatlan teljes személyes rekordot. A fióktörléshez/anonimizáláshoz tudatos előzménykezelés szükséges; az adatmegőrzés és a visszaállítás követelményeit előre rögzíteni kell.

**Elfogadási feltétel:** minden érzékeny művelet visszakereshető, a fodrász nem tudja törölni a saját auditnyomát, a jogosultság és megőrzés tesztelt.

### SEC-12 – OG-portré túl késői méretellenőrzése

**Bizonyíték:** [pages/api/og.jsx](pages/api/og.jsx#L31): a válasz teljes `arrayBuffer()` tartalma bekerül a memóriába, és csak ezután történik a 8 MB-os ellenőrzés. A távoli hívás host/path szerint szűkített, redirect tiltott és timeoutos; ez jó SSRF-védelem.

**Kockázat:** túl nagy engedélyezett Storage-objektum átmenetileg túl sok memóriát foglalhat, párhuzamos kéréseknél többszörösen. Ez feltételes: profiloldal és megfelelő Storage-URL szükséges; az éles projektben az audit idején **0 Storage bucket** volt, ezért ezt ott nem demonstráltam.

**Javítás:** `Content-Length` előellenőrzés, de ettől független streamelt byte-limit és megszakítás; feltöltési méret- és képméretkorlát, szükség esetén képméret/pixelszám ellenőrzése.

**Elfogadási feltétel:** fejléc nélküli vagy megtévesztő méretű, 8 MB feletti tesztválasz olvasása a limitnél megszakad, és névalapú OG-kép készül.

### SEC-13 – aktív admincímek felismerhetők az OTP-válaszokból

**Bizonyíték:** [admin/auth/send-code.js](pages/api/admin/auth/send-code.js#L11). Nem kezelői címnél azonnal `200 {ok:true}` jön; aktív kezelőnél valódi OTP-küldés történik, amely `429` vagy `503` választ is visszaadhat. Így az egységes sikerüzenet ellenére eltérhet a státusz és az időzítés.

**Hatás:** aktív kezelői címek megerősítése célzott adathalászathoz vagy jelszótámadáshoz. Nem ad közvetlen belépést. Éles címeken nem végeztem ismételt OTP-próbálgatást.

**Javítás:** korlátozott, lehetőleg aszinkron OTP-dispatch; kívülről egységes szerződés és ne a fiók létezésétől függő publikus hiba. A rate limit és botvédelem maradjon aktív, a felhasználó kapjon érthető visszajelzést a cím létezésének felfedése nélkül.

**Elfogadási feltétel:** ismert és ismeretlen tesztcímek státuszából és hibaformátumából nem derül ki a kezelői tagság; a rendszer nem küld korlátlan e-mailt.

## 4. Ami jelenleg megfelelően védett

- Az éles alkalmazás összes vizsgált tábláján – **8 public és 2 private táblán** – aktív az RLS. Nincs általános, névtelen olvasási engedély az alkalmazástáblákra. Nem találtam RLS-t megkerülő alkalmazás-view-t a két sémában.
- A `guest_profiles`, `booking_managers` és `trusted_devices` nem kap közvetlen `anon` / `authenticated` táblajogot. A megmaradt guest-profile policy önmagában nem ad hozzáférést GRANT nélkül.
- A staff-hozzáférés élő `auth.users`-azonosságot, megerősített e-mailt, aktív jogosultságot, aktív fodrászt és külön admin-eszközcredentialt követel. Nem a felhasználó által szerkeszthető `user_metadata` dönt a szerepkörről.
- A legtöbb dolgozói művelet a dolgozó saját JWT-jével és a külön admin-eszközfejléccel fut, így a szerveroldali szűrés mellett az RLS is érvényesül. A secret kulcsú műveletek külön vizsgálata továbbra is fontos, mert azok privilegizáltak.
- A vendég- és admin-cookie-k külön vannak. Éles módban `HttpOnly`, `Secure`, `SameSite=Lax`; aláírt határidő, 32 véletlen byte-os eszközcredential és csak annak SHA-256 lenyomata kerül az eszköztáblába.
- A manipulált, lejárt vagy törölt eszköz és a másik felhasználóhoz tartozó eszközazonosító elutasítása tesztelt. A párhuzamos eszközhosszabbítás nem támaszt fel törölt rekordot.
- A módosító végpontok Origin-ellenőrzése a vizsgált CSRF-próbákat elutasította. Az Origin nélküli és idegen Originű foglalási POST `403`, megfelelő eredetű, de bejelentkezés nélküli kérés `401` lett. Nem találtam nyitott, hitelesített CORS-hozzáférést.
- A foglalásmentés a felhasználót, árat, szolgáltatást és időt szerveroldalon ellenőrzi; nem fogad el kliens által bemondott vendégazonosítót vagy árat. A staff/service összerendelést éles összetett FK védi.
- Foglalási ütközésekre adatbázisoldali kizárási constraint-ek, ütemezési trigger és tranzakciós lockok is vannak. A local integration tesztek munkaidőn kívüli foglalást, távollétütközést és konkurens mentést is vizsgálnak.
- A fontos privilegizált függvényeknél rögzített `search_path` és szűk EXECUTE-jogok vannak. A havi foglalási műveletek ellenőrzik az adminazonosságot; a belső triggerfüggvények nem szabadon hívható RPC-k.
- A nyilvános katalógus explicit mezőlistából épül; a személyes e-mail és vendégadat nem része a publikus profilnak. A JSON-LD szerializálás a scriptből való kitörést védi, az e-mail HTML-je escape-eli a dinamikus szövegeket. Nem találtam közvetlen, vendégbemenetet értelmező `eval`/shell/HTML-injektálási utat.
- A Gitben követett fájlokban és az archívumban végzett célzott credential-mintakeresés nem talált tényleges éles secretet; egy tesztkulcs-minta álpozitív volt. A helyi `.env.local` Git által kizárt; a signing secret hossza elégséges, entrópiáját és korábbi megosztásait nem lehet ebből bizonyítani. Az ellenőrzött HTML-ben nem jelent meg secret kulcs.
- Az éles `demeters-purge-expired-devices` Cron-job aktív, és eszköztisztítást végez. A futási sikertörténetet és az összes megőrzési követelményt ez önmagában nem igazolja.

A Security Advisor további **4 „RLS Enabled No Policy” információs jelzése** a két privát havi táblára, a `booking_managers` és a `trusted_devices` táblára vonatkozott. A vizsgált hozzáférési modellben ezek szándékosan nem nyitottak közvetlen kliensnek; az Advisor kedvéért nem szabad rájuk engedékeny policy-t tenni. [Advisor-magyarázat](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## 5. A mellékelt séma értelmezése

A csatolt export figyelmeztetése helyes: **nem futtatható migráció**. Nem mutat minden policy-t, engedélyt, indexet, kizárási constraint-et vagy triggert. Az `appointment_service_owner` hivatkozást két külön FK-sornak láttatja; az élő `pg_constraint` szerint valójában ez az érvényes összetett korlát:

```sql
FOREIGN KEY (service_id, staff_id)
REFERENCES public.booking_services(id, staff_id)
```

Ezért a mellékelt szöveg alapján sem hiányzó RLS-t, sem hibás service/staff összerendelést nem állapítottam meg. Az éles metaadat-lekérdezés megerősítette a védelmeket, és külön igazolta a SEC-07-ben felsorolt hiányzó új mezőket.

## 6. Javítási sorrend a lehető legbiztonságosabb kiadáshoz

### Első kör – kiadás előtti megerősítés

1. **SEC-01:** támogatott keretrendszerre migrálás és az audit alkalmazhatósági listájának lezárása; stagingen teljes foglalási és adminregresszió.
2. **SEC-02:** megosztott rate limit, OTP-botvédelem és atomikus foglalási kvóta. Ellenőrizni a Vercel és Supabase oldali limiteket is.
3. **SEC-03–04:** főadmin-MFA, érzékeny műveletek friss hitelesítése, szolgáltatói jelszóvédelem.
4. **SEC-07:** éles séma és migrációtörténet rendezése, mentés és visszaállítási terv mellett.

### Második kör – munkamenet, adatbiztonság és rendelkezésre állás

5. **SEC-05:** teljes visszavonási folyamat és abszolút admin-session-határ; letiltott fiók ne hosszabbíthasson.
6. **SEC-06:** verziózott szerkesztések és konfliktusjelzés.
7. **SEC-09–10:** hívási időkeretek, idempotencia, tranzakciós outbox, visszakereshető értesítési állapotok.
8. **SEC-08 és SEC-11:** CSP és személyes adatokat minimalizáló auditnapló.
9. **SEC-12–13:** streamelt képlimit, OTP-válaszok egységesítése.

### Üzemeltetési ellenőrzések, amelyek még nem bizonyítottak

- [ ] Élesen ugyanaz a forrás és zárfájl fut, amelyet ellenőriztünk; tiszta `npm ci` telepítés és ellenőrzött Node-verzió.
- [ ] Éles security headerek, TLS/HTTPS-átirányítások, domain- és deployment-hozzáférések ellenőrizve; preview saját védelme beállítva, mert a `noindex` nem hozzáférés-védelem.
- [ ] Főadmin, Supabase, Git-szolgáltató, tárhely, DNS és levelezés fiókjain MFA; hozzáférések a szükséges személyekre korlátozva.
- [ ] Auth: OTP lejárat/hossz, jelszópolitika, biztonságos e-mail/jelszóváltás, JWT/session-élettartam, CAPTCHA és e-mail-kvóták áttekintve.
- [ ] A secret kulcsok csak szerveroldali környezetben vannak; teszt/preview/production elkülönítve, rotációs eljárás és hozzáférési napló ismert. A széles jogú Supabase secret helyett ahol lehet szűk RPC / jogosultságot megtartó JWT.
- [ ] Visszaállítható, ellenőrzött mentés és tényleges visszaállítási próba; ismert RPO/RTO. A platformon látható mentés önmagában nem visszaállítási próba.
- [ ] Riasztások: hibás belépések, OTP-forgalom, `429/5xx`, rendellenes foglalásszám, sikertelen e-mailek, Cron/outbox-hibák és váratlan jogosultságváltozás.
- [ ] Személyesadat-megőrzés, törlés/anonimizálás, e-mailek és szolgáltatói logok megőrzése dokumentált; a projektben nincs végigvezetett teljes folyamat. Az adatkezelési tájékoztatót külön kell ellenőrizni.
- [ ] Automatizált CI: lint, unit, izolált DB-tesztek, API-jogosultsági regresszió, dependency audit és secret scanning. A repóban nincs beállított GitHub Actions pipeline; más külső pipeline létezése nem ellenőrzött.
- [ ] Az `Archívum.zip` nem kerül nyilvános statikus tárhelyre. A jelen projektben nem a `public/` alatt van; a teljes repó gyökerét kiszolgáló tárhelybeállítás veszélyes lenne.

## 7. Megismételhető ellenőrzések

Az alábbiak helyi / elkülönített környezetben használhatók. Az éles adatbázison sem terheléstesztet, sem módosító próbát nem szabad ezek helyett automatikusan indítani.

```bash
npm test
npm run lint
npm audit --json
npm audit --omit=dev --json
```

Az adatbázisteszt külön telepített `embedded-postgres` és `pg` függőségeket igényel; az auditban használt helyi QA-könyvtár nem a projekt futási függősége:

```bash
DEMETERS_QA_MODULES=/private/tmp/demeters-monthly-qa npm run test:db
```

A HTTP-próbák többek között ezeket ellenőrizték: admin/vendég/eszköz/foglalás API belépés nélkül `401`; Origin nélküli, `null` és idegen Originű foglalási POST `403`; hibás metódus `405`; időablakon kívüli availability `400`; érzékeny válasz `no-store`, nyitott CORS nélkül. A párhuzamos szerkesztés bizonyításához mindkét olvasás ugyanazt a mockolt rekordot kapta, majd két valódi `editAdminAppointment()` hívás mentett rá.

Az audit futási naplói átmeneti helyi fájlokban vannak: `/private/tmp/demeters-security-{unit,lint,db,build,http,race}.log`, az npm-pillanatképek `/private/tmp/demeters-security-npm-{audit,prod}.json`. Ezek nem verziózott bizonyítéktárak; tartós megőrzésüket külön kell megoldani. A jelentés tartalmazza a lényegi eredményeket, éles hitelesítő adatot nem.

**Kiadási feltételként a P1-tételek lezárását, a sémaeltérés rendezését és a biztonsági regressziós próbák megismétlését javaslom.** A többi tételt is ütemezni kell; a sikeres tesztek és a meglévő RLS-védelem nem pótolják a hiányzó visszaélés-, munkamenet- és üzemeltetési kontrollokat.
