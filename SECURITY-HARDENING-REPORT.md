# DEMETERS – security hardening átadás

Dátum: 2026. november 27., Europe/Budapest. Kiindulás: `c47e324`; fejlesztési branch: `security-hardening`. A módosítások a helyi munkakönyvtárban találhatók.

**A javítások implementációja és helyi ellenőrzése elkészült. Production migráció, deployment, előfizetésváltás és éles levélküldés nem történt. A kiadási feltételek még nem teljesülnek az éles szolgáltatásban.** Különösen: a Supabase szervezet ellenőrzötten Free csomagban van, a leaked-password protection kikapcsolt, a SEO-sémaeltérés még fennáll. Ezeket nem jelölöm élesben lezártnak.

Az eredeti `BIZTONSAGI_AUDIT.md` megmaradt. A Pages Router, a magyar/angol URL-ek, canonical/hreflang, JSON-LD, sitemap, ISR/SSR és a meglévő megjelenés fennmaradt. Új felületelem csak az MFA, az újrahitelesítés, a konfliktus kezelése és a botellenőrzés miatt került be. Éles vendégadatokat nem exportáltam.

## 1. A 13 megállapítás állapota

| Tétel | Implementáció és ellenőrzés | Éles lezárás feltétele |
| --- | --- | --- |
| SEC-01 | Next **16.4.6**, React/React DOM **19.3.1**, Motion **14.14.0**, PostCSS **8.5.34**, Sharp **0.35.5**, pontos verziók és lockfile. `proxy.js`, közvetlen ESLint CLI, webpack build. A teljes és production npm auditban **0 riasztás**. | Jóváhagyott deployment és szolgáltatói smoke test. |
| SEC-02 | Atomikus PostgreSQL limiter, IP / cím / forrás+cím / user limitek, HMAC-azonosítók, 429 + Retry-After, sikertelen belépési backoff, szerveres Turnstile-ellenőrzés és token-egyszerhasználat. Tranzakciós foglalási kvóta. Nyilvános availability olvasás nem materializál. | Migráció, valódi Turnstile-kulcsok, megbízható Vercel proxy, Cron és WAF ellenőrzése. |
| SEC-03 | Supabase TOTP enroll/challenge/verify/unenroll; ownernek AAL2 kötelező; barbernek beállítható, beállítás után kötelező. API + DB/RLS védelem. Érzékeny műveleteknél legfeljebb 5 perces TOTP-bizonyíték. | Valódi providerrel staging próba, owner első és tartalék faktorának ellenőrzése, helyreállítási eljárás. |
| SEC-04 | Élő Advisor újra ellenőrizve: **Leaked Password Protection Disabled**. A szervezet **Free**. A kód 12–128 karakteres új kezdő jelszót követel; a teljes Auth-politika dashboardos feladat. | **Nyitott P1**. A szolgáltató a leaked-password protectiont Pro csomagtól adja. Külön üzleti döntés / szolgáltatói megoldás szükséges; automatikus csomagváltás nem történt. |
| SEC-05 | Admin: alapból 24 óra abszolút, 30 perc inaktivitási korlát, aktív jogosultság ellenőrzése hosszabbítás előtt, session_id-kötés. Deaktiválási trigger visszavonja az admineszközöket. Vendég 60 napos sliding megjegyzése megmarad. | Migráció és valódi eszköz/session visszavonási próba. A szolgáltatói távoli logout az összes többi sessiont visszavonja; részleges providerhiba külön jelzett. |
| SEC-06 | DB-generált revision és feltételes mentés a foglalásnál, státusznál, végleges törlésnél, távollétnél, szolgáltatásnál, profilnál, heti órarendnél és fióknál. Fiók+profil véglegesítése közös tranzakció. Elavult mentés 409; kézi frissítés. | Migráció + kliens együttes kiadása. Régi klienstől hiányzó verziót nem fogadunk el. |
| SEC-07 | Élő oszlopok, migration registry, indexek, constraint-ek, triggerek, policy-k és RPC-jogosultságok olvasással ellenőrizve. Külön, megismételhető SEO-reconciliation készült és kétszeri futtatással tesztelt. | **Az éles eltérés továbbra is fennáll**; kizárólag a jóváhagyott új SQL-ek alkalmazhatók. Történeti migrációkat nem szabad vakon újrafuttatni. |
| SEC-08 | Alapértelmezés: **Report-Only**. Előkészített `CSP_MODE=enforce`; külső runtime script, inline script engedély nélkül. Valódi Chromium próba, natív CSP-jelentés fogadása, injektált inline script blokkolása. | Saját preview/production források és valódi Turnstile widget Report-Only megfigyelése, majd külön build enforce módban. |
| SEC-09 | Egységes AbortSignal timeout, teljes választestre is; requestenként 25s keret; szolgáltatói időkorlátok; request ID; exponenciális backoff+jitter. Automatikus retry csak olvasásnál vagy idempotenciakulccsal. | Valós upstream késleltetési adatok alapján hangolás. |
| SEC-10 | Tranzakciós, címzettenkénti outbox; pending/processing/sent/failed; SKIP LOCKED, lease-token, megszakadt worker helyreállítás, legfeljebb 8 próbálkozás, deduplikáció, Resend idempotenciakulcs. Felhasználóhoz kötött foglalási idempotencia. | Cron, Resend-kulcs/domain és sender ellenőrzése; egy staging küldés. A sikeres foglalás az e-mail állapotától független. |
| SEC-11 | Privát, alkalmazás-adminoknak nem írható/olvasható auditnapló, actor ID, művelet, rekord, idő, request ID, változott mezőnevek. Jelszó/OTP/token/kapcsolati értékek nélkül. Auth-törléskor anonimizálás és SET NULL, előzmények megőrzése. | Adatmegőrzési szabály jóváhagyása és mentési/visszaállítási próba; éles audit UI nem került be. |
| SEC-12 | Content-Length előellenőrzés; stream byte-limit, megszakítás, 8 MB, 16M pixel, legfeljebb 8000 px oldal, raster-formátum és animáció ellenőrzés. HTTPS / pontos projekt-origin / public Storage útvonal / redirecttiltás megmaradt; névalapú OG fallback. | Valódi Storage-bemenet staging próbája. A generált OG továbbra is 1200×630 PNG. |
| SEC-13 | Admin OTP-kérés egységesen csak sorba állít. Tagsági ellenőrzés kizárólag workerben, HTTP-válasz után; nem létező cím is azonos státuszt és formátumot kap. Szimulált provideres HTTP regresszió sikeres. | Cron működjön; valódi SMTP kézbesítési próba. Nincs bizonyított tökéletes időzítési indistinguishability-garancia. |

## 2. Adatbázis-változtatások

A Supabase CLI-val létrehozott új migrációk, ebben a sorrendben:

1. `20261127221722_security_hardening_core.sql`: privát üzleti/biztonsági beállítások, limiter/backoff, kvóta, revision mezők/triggerek, idempotenciakulcsok, SET NULL és anonimizálás.
2. `20261127221728_security_hardening_auth.sql`: eszköz–Auth-session kötés, AAL2/RLS, abszolút és idle limitek, deaktiválási visszavonás, friss MFA végleges törléshez.
3. `20261127221729_security_hardening_outbox.sql`: outbox/audit, foglalási eseménytriggerek, claim/ack/maintenance RPC, csak olvasó havi blokkok, verziózott órarend/ismétlés/fiókvéglegesítés.
4. `20261127222902_reconcile_public_seo_profiles.sql`: hiányzó publikus profil/fordítás/slug-history elemek. Meglévő slugot, bio-t és fordítást nem ír felül. Kétszer újrafuttatva is ellenőrzött.

A core/Auth/outbox migrációk normál, egyszer alkalmazandó verziózott migrációk, tranzakcióval. A negyedik kifejezetten reconciliation célra újrafuttatható. A régi `20261127105305_public_seo_profiles.sql` fájlt nem módosítottam; az éles adatbázison sem ezt, sem a teljes történetet nem futtattam újra.

A kezdeti élő nyilvántartásból hiányzott a `20261127105305` és több korábbi, részben már alkalmazott sémafrissítés. A publikus SEO-oszlopok ténylegesen hiányoztak. A meglévő staff-service összerendelési constraint és GiST ütközésvédelem létezett; ezeket az új kód nem gyengíti. Az élő `user_id` FK még CASCADE volt.

A `supabase/sql/security_hardening_preflight.sql` olvasási ellenőrzés. A `supabase/sql/security_hardening_schedule.sql` külön, jóváhagyandó üzemeltetési beállítás; nem része automatikus migrációnak. Egyik sem futott productionön.

**A meglévő vendég/fodrász/foglalási rekordokat a migráció nem törli.** Az új adminvédelmek miatt a régi, session_id nélküli adminbelépés új bejelentkezést igényel. Meglévő vendégcookie-k átmenetileg használhatók; új vendégbelépés már session_id-t köt. Meglévő kvóta feletti foglalásokat nem törlünk; új online foglalás csak a korlát alá kerülés után engedett. A manuális, jogosult adminfoglalás kvótakivétel lehet, de a meglévő dupla foglalás- és munkaidővédelmeket nem kerüli meg.

## 3. Működés és adatmegőrzés

- A limiter IP-t/e-mailt nem tárol: környezetenként külön titokkal képzett HMAC-kulcs, számláló és lejárat kerül a DB-be. Éles Vercelen csak a platform `x-vercel-forwarded-for` fejléce használható; helyi gépen a közvetlen socket címe. Más hostingnál külön hiteles proxyadapter kell, nem szabad kliens X-Forwarded-Forra átállni. Hiányzó/hibás proxykonfiguráció elutasítást okoz.
- OTP küldési alaplimit: IP 8/10 perc, forrás+cím 3/10 perc, cím 5/10 perc. Verify/password: IP 25/10 perc, forrás+cím 10/10 perc. Nyilvános olvasások 120/perc/IP, új foglalás 10/10 perc/user, MFA 15/10 perc/user. A címre irányuló küldési limit nem tiltja le a fiók kódellenőrzését vagy más IP-ről való belépését.
- Sikertelen ellenőrzésekhez külön forrás+cím backoff tartozik, legfeljebb 1,5s késleltetéssel; sikeres próbák nem növelik ezt a számlálót. Ismételt sikertelen próbák 10 perc után kifutnak.
- A kvóta és az admin session-beállítások a `private.security_settings` egyetlen sorában módosíthatók. Például jóváhagyott SQL-lel `update private.security_settings set max_future_bookings=3, require_staff_mfa=false where singleton;`. Normál admin JWT nem írhatja ezt a táblát. A változás auditálódik.
- Az idempotencia a user ID + UUID kulcs + normalizált foglalási szándék hash alapján működik. A frontend sessionStorage-ban csak a szolgáltatás/fodrász/nap/idő szándékot és a véletlen kulcsot őrzi, kapcsolatadatot/tokeneket nem. A replay az eredeti tranzakciós eredményt adja vissza; más tartalmú újrapróba 409. A megőrzési ablak **7 nap**.
- Az outbox egy esemény/címzett kulcsot használ, így részlegesen elküldött páros értesítés nem küldi újra a másik címzett levelét. Lease: 2 perc. Backoff: exponenciális, jitterrel, felső korlát 6 óra. 23 óránál régebbi feldolgozatlan levél terminális hibába kerül: a szolgáltatói 24 órás idempotenciaablakon túl nem küldünk vakon újra. Az admin OTP nem idempotens provider-művelet: legfeljebb egyszer dispatch-elhető; bizonytalan kimenetelnél a felhasználó új kódot kérhet.
- Sikeres levél payloadja 7 nap után törlődik; régi payload legfeljebb 30 napig, operatív outbox metaadat legfeljebb 90 napig marad. Admin OTP-feladat 15 perc után törlődik. Auditmegőrzés: 365 nap. Lejárt limiter rekordok +1 óra puffer után takaríthatók. Ezek alapértékek, üzleti/adatkezelési jóváhagyást igényelnek.
- Az audit csak mezőneveket tárol. A normál session-touch nem gyárt auditbejegyzést minden API-hívásnál; létrehozás, átnevezés és visszavonás igen. Actor ID automatizmusnál lehet NULL; közvetlen SQL/adminisztráció esetén a szolgáltatói hozzáférési napló is szükséges. Hiányzó request ID-t a DB generál.
- Auth-fiók törlése eltávolítja az eszközöket, a kulcsos replay-snapshotokat és a hozzá kötött queued személyes adatokat, anonimizálja a foglalási előzményt, leállítja a hozzá kötött havi sorozatot. Nem történik automatikus Auth-fióktörlés.

Távoli eszköz visszavonásakor először az alkalmazásrekord törlődik. A Supabase dokumentált logout API nem biztosít ebben az integrációban tetszőleges session_id-ra célzott törlést; ezért `scope=others` terminálja az összes többi provider-sessiont. Erről a felület előre szól. Az aktuális eszköz `scope=local` ágat használja. Providerkieséskor az alkalmazásvisszavonás érvényben marad, a válasz/értesítés jelzi a provider-rész sikertelenségét; ilyenkor külön szolgáltatói visszavonást kell ismételni. Nem állítok garantált provider-visszavonást szolgáltatói leállás alatt.

A már kiadott access JWT kriptográfiailag lejáratig érvényes lehet. A kritikus admin RLS ellenőrzi az Auth-session létezését, az eszközt, az aktív szerepet és AAL-t; az új vendégeszközök szerveres session-ellenőrzést kapnak. Az alap vendégprofil-táblák közvetlen kliens GRANT-ja továbbra is tiltott. Ez nem azonos minden lehetséges Supabase-termék JWT-jogosultságának univerzális visszavonásával.

## 4. Tényleges ellenőrzések

Az eredeti 113 unit eset megmaradt, az admin 7 napos korlátlan sliding elvárást az új 24h/idle szabályhoz aktualizáltam. Az eredeti 54 DB-ellenőrzés a régi migrációs lépcsőket is ellenőrzi, majd az új védelemre további tesztek futnak. Az eredeti 16 HTTP-próba verziózott tesztfájlba került.

| Ellenőrzés | Tényleges eredmény |
| --- | --- |
| Tiszta `npm ci` | Sikeres; lockfile reprodukálható. |
| `npm test` | **129/129** sikeres. |
| `npm run test:db` | **72/72** sikeres, elkülönített **PostgreSQL 17.12** motoron; éles motor 17.11. |
| `npm run lint` | **0 hiba, 7 meglévő figyelmeztetés**. |
| Fixture production build, Next 16.4.6 | Sikeres. |
| `npm run test:http` | **19/19**, az eredeti 16 + cron/MFA/CSRF. |
| `npm run test:auth` | **5 HTTP-tesztcsoport**, szimulált Supabase/Turnstile; enumeration, szerveres botvédelem, AAL1/stale AAL2 elutasítás, MFA-cookie frissítés, utolsó faktor védelme. |
| `npm run test:seo` | **11 csoport**: 14 HU/EN oldal, 16 sitemap URL, 404/redirect, JSON-LD/metadata, OG PNG, 320/390/768/1440px, nyelvváltás. |
| `npm run test:ui` | **25** naptár-, foglalási-, távollét-, fiók- és jogosultsági böngészőellenőrzés. |
| `npm run test:services` | **8** szolgáltatás/profil/órarend/nyelvi böngészőellenőrzés. |
| `npm run test:isolation` | **6** sikeres csoport, mobil/desktop szerepváltás és új session-élettartam címkék. |
| `npm run test:security-ui` | **2** sikeres csoport: hét HU/EN/admin oldal, inline-injektálás tiltása és natív CSP-report 204. |
| `npm run test:responsive` | **35** sikeres mobil/desktop adminellenőrzés. |
| `npm audit --json`, `--omit=dev --json` | Mindkettő **0** érintett csomag. |
| `npm run test:secrets` | Követett és nem ignorált szövegfájlok + helyi Git-történet mintavizsgálata sikeres. |

Konkurenciapróbák valódi külön PostgreSQL kapcsolatokkal futottak: pontos limiterküszöb, guest kvótaverseny, booking/absence kizárás, dupla foglalás, revision-verseny, idempotens párhuzamos foglalás, outbox lease helyreállítás és stale ack elutasítása. A foglalásszerkesztési API-t két valódi `editAdminAppointment()` hívással is ellenőriztem.

A browser tesztek determinisztikus API-fixture-t használnak; a DB-tesztek valódi Postgresen futnak. A hitelesítési provider teszt **szimuláció**, nem éles Supabase MFA/SMTP bizonyíték. Valódi OTP-t nem küldtem; éles terhelésteszt nem volt. A GitHub Actions workflow elkészült, de GitHubon még nem futott; a Linux runner eredményét nem állítom ellenőrzöttnek.

A futási naplók: `/private/tmp/demeters-hardening-{unit,db,lint,build,http,auth,seo,ui,services,isolation,responsive,csp,secrets}.log`; npm JSON-ok ugyanitt. A dokumentum tartalmazza a lényegi eredményeket, a tmp-fájlok nem tartós bizonyítéktárak. Kiadáskor a CI artifactokat és a jóváhagyott snapshotokat hozzáférésvédett helyen meg kell őrizni.

## 5. Környezeti változók és szolgáltatói beállítások

A `.env.example` tartalmazza a neveket, valódi titkok nélkül. Új szerverváltozók: `RATE_LIMIT_SECRET` (legalább 32 karakter, külön a session titoktól), `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAMES`, `CRON_SECRET` (legalább 32 karakter), `CSP_MODE`, opcionális `HTTP_AUTH_TIMEOUT_MS`, `HTTP_DATABASE_TIMEOUT_MS`, `HTTP_RESEND_TIMEOUT_MS`, valamint `RATE_<SCOPE>_LIMIT` egész értékű felülírások. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` szándékosan publikus, build idején beépül. Minden más titok kizárólag szerveroldali.

Supabase, külön jóváhagyással:

1. A megadott projekten futtasd a preflight olvasási SQL-t, mentsd a séma-, grant-, trigger- és függvénydefiníciókat; ellenőrizd a migration registryt. A kódhoz tartozó projektref: `fdvhdpguhqjmoojarurz`.
2. Authentication → MFA: TOTP enrollment és verification legyen engedélyezett. Authentication → Sign In / Providers → Email: minimum jelszóhossz legalább 12; biztonságos jelszócsere és megfelelő karakterszabályok. A pontos jelenlegi Auth dashboard értékeket nem tudtam a csatlakoztatott eszközökkel teljeskörűen kiolvasni.
3. Leaked-password protection: Free csomag miatt jelenleg nincs elérhető bekapcsolás. Csomagot csak külön jóváhagyás után szabad váltani; utána a jelszóbiztonsági beállításoknál kapcsold be, futtasd újra az Advisort és ellenőrizz tesztfiókkal. A figyelmeztetés jelenleg nyitott.
4. Ellenőrizd a custom SMTP küldőt, OTP-kvótákat/lejáratot és a sikertelen auth-próbák dashboard-naplózását. A jelenlegi vendégfolyamatot ne alakítsd másfaktorossá. Supabase saját CAPTCHA-ját ne kapcsold be vakon ugyanazzal a már felhasznált Turnstile-tokennel; az alkalmazás önálló Siteverifyt végez.
5. Ellenőrizd a JWT expiry-t; kritikus adminhoz rövid, például legfeljebb 1 órás JWT-időszak és a DB-session védelem együttesen szükséges. A provider beállítását nem változtattam meg.
6. A Cron és Vault jelenléte olvasással igazolt; `pg_net` még nincs telepítve. Engedélyezd külön a Database → Extensions felületen, tedd a worker URL-t és a Cron titkot Vaultba, majd az ellenőrzött schedule SQL-lel hozd létre az új jobokat. A már létező `demeters-purge-expired-devices` jobot ne töröld. A script a `net` sémát nem teszi böngészőből elérhetővé.

Vercel / Cloudflare / Resend:

1. Production és preview külön Supabase projektet, session/rate/Cron titkokat, sender-kulcsokat és Turnstile widgetet kapjon. Previewt ne kösd automatikusan az éles személyes adatokhoz. A preview oldalakon marad a noindex, és a Vercel Deployment Protection külön legyen bekapcsolva.
2. Vercel Node runtime: 22 LTS. Build: `npm run build`; lint külön CI-lépés. Pages Router/ISR/SSR marad, `proxy.js` viszi a korábbi middleware logikáját. A middleware/proxy nem önálló hitelesítési határ.
3. Firewall → WAF/Rate Limiting: ellenőrizd a rendelkezésre álló csomagfunkciókat; OTP/password végpontokra bot/challenge és IP-szintű korlát, public keresésre külön küszöb, SQL injection/XSS managed szabályok, log-only megfigyelés után fokozatos blocking. A normál booking API-kat ne tiltsd minden POST-ra. Konkrét WAF-állapotot nem tudtam kiolvasni, szabályt nem telepítettem.
4. Turnstile: managed widget a tényleges HU/EN domainhez; helyes site/secret kulcspár, engedélyezett hostok. Valódi widgettel próbáld a send-code/password műveletet mobilon is. Élesben hiányzó szerverkonfiguráció esetén a botvédett belépés elutasít, nem kapcsol ki csendben a védelem.
5. Resend domain/sender és kvóták ellenőrzése; egy staging foglalás + lemondás valódi kézbesítési próbája. Küldési hiba nem írhatja vissza vagy törölheti a foglalást.
6. `CSP_MODE=report-only` legyen az első saját deploymentben. Ellenőrizd a CSP logokat és az összes tényleges külső forrást; utána új build `enforce` módban. A CSP buildkonfiguráció, pusztán runtime env-átírás nem módosít már elkészült header-manifestet. `img-src https:` a meglévő, tetszőleges publikus HTTPS profil-/portfólióképek miatt maradt; script/connect nincs wildcarddal engedélyezve. `style-src unsafe-inline` a meglévő React/Motion stílusokhoz szükséges. Script unsafe-inline nincs.

## 6. MFA bevezetés és helyreállítás

Az owner első faktorral be tud lépni az **MFA-beállítási** felületre; az adminadatokhoz és API/RLS-műveletekhez ekkor még nem fér hozzá. Ez teszi lehetővé a jelenlegi owner biztonságos bevezetését előre kódolt kivétel vagy közös bypass titok nélkül. A TOTP kulcsot hozzáadja az authenticatorhoz, majd egy tényleges kóddal ellenőrzi. Siker után a provider új AAL2 access/refresh tokent ad, kizárólag HttpOnly cookie-ba.

Bevezetéskor a tulajdonos állítson be és ellenőrizzen **második, külön tárolt tartalék TOTP-eszközt** is. A már meglévő faktor mellé új faktorhoz friss MFA kell. Az utolsó ellenőrzött faktor az alkalmazásból nem távolítható el. Érzékeny művelet 403 `reauth_required` válaszánál a felület kódot kér; csak a szerver által még végre nem hajtott kérést ismétli meg. Elavult adatverzió esetén továbbra is 409 lesz, nem automatikus adatfelülírás.

Elveszett első eszköznél a tartalék faktorral kell belépni, új tartalékot felvenni, utána a hiányzót eltávolítani. Ha minden faktor elveszett: a Supabase projekt tulajdonosa külön, dokumentált személyazonosság-ellenőrzés után, admin/dashboard jogosultsággal vonja vissza a régi Auth-sessionöket és az admin trusted device rekordokat, távolítsa el az elveszett faktort, majd felügyelt új OTP + új TOTP enrollment következzen. Rögzíteni kell az operátort, időpontot, érintett user ID-t és a jóváhagyást. Ne kapcsoljátok ki globálisan az owner MFA-követelményt, ne osszatok meg service kulcsot a felhasználóval. A dashboard-helyreállítást és a tartalékból belépést staging környezetben még végre kell hajtani.

## 7. Monitorozás, teljesítmény és költség

A szerver strukturált request ID-s 429/4xx/5xx logokat és worker számlálókat ír; CSP-jelentésből csak direktíva/disposition kerül logba. Nincs e-mail-cím, raw IP, teljes URL-query, OTP vagy bearer a biztonsági logban. A normál DB hibaszövegek operatív elérését is korlátozni kell.

Kiadás előtt állítsatok figyelmeztetést: 5 perces emelkedő 429/401/5xx arány; outbox `failed > 0`; legrégebbi pending 5 percnél régebbi; 2 perc után beragadt processing; 2 egymást követő hiányzó/hibás cron HTTP-hívás; SMTP/Resend quota. A `cron.job_run_details` sikere önmagában nem jelenti a `pg_net` HTTP-hívás sikerét: ellenőrizni kell `net._http_response.status_code`, `timed_out`, `error_msg` mezőit is. A Vault titkot tartalmazó request queue nem kerülhet logba vagy API-válaszba.

Példa kizárólag jogosult SQL-operátornak:

```sql
select status,count(*),min(created_at) oldest
from private.notification_outbox group by status;
select id,kind,audience,attempts,last_error,created_at
from private.notification_outbox where status='failed' order by created_at desc;
select actor_id,action,record_type,record_id,request_id,occurred_at
from private.security_audit_log order by occurred_at desc limit 100;
```

A public availabilityből eltűnt a materializáló írás. Ha a cron késik, csak olvasó havi-sorozat RPC védi a felkínált időpontokat; mentéskor az eredeti DB materializálási/ütközési védelem is megmarad. Earliest keresésnél a katalógus és munkaidő egy kérésen belül egyszer töltődik, nem minden hónapra újra. Dekorálás továbbra is csoportos staff/service lekérdezést használ. A frontend cache és a foglaláskor friss ellenőrzés megmaradt. A foglalás válaszidejébe a Resend-hívás már nem számít bele.

A limiter jogosult nyilvános keresésenként 1 indokolt, atomikus DB-írást ad; az adminvédelem többlet ellenőrzéseket és device touch-t használ. A teljesítményhatás kód alapján követhető és helyben fixture-rel ellenőrzött, **éles p95 és költségmérés nem történt**. Kiadás előtt stagingben mérendő: availability/earliest, barber/service váltás, létrehozás, naptár és vendégprofil, upstream szám és function duration. A lokális fixture-latencia nem lenne érvényes Supabase-latencia bizonyíték.

Új fizetős limiter/sor szolgáltatás nincs. A már elérhető PostgreSQL/Cron/Vault és az opcionálisan engedélyezendő pg_net használható. Percenkénti worker legfeljebb kb. **1440 HTTP invokáció/nap, 43 200/30 nap** üres sor esetén is; egy claim üres soron is fut. Jobonként 10 feladat; szükség esetén a sor korát figyelve kell méretezni. Az adatbázis-, Vercel- és Resend-kvóták tényleges fogyasztását ellenőrizni kell. Nem állítom, hogy minden meglévő csomagkeretbe garantáltan belefér. Vercel perces Cron előfizetés nem szükséges; a Supabase schedule a választott megoldás. Leaked-password protectionhoz a jelenlegi Free csomagon kívüli lehetőség kell; árat/csomagváltást nem vállaltam automatikusan.

## 8. Kiadási sorrend és visszaállítás

1. Review és CI: tiszta install, lint/unit/DB/audit/secret scanning/build/HTTP/browser eredmények megőrzése. A workflow fájlja `.github/workflows/security.yml`; nem kap production titkot, kizárólag fixture adatot használ. Kapcsoljatok branch protectiont a sikeres `verify` checkre.
2. Megoldandó a nyitott P1 jelszóbiztonsági feltétel. Döntés nélkül a kiadást nem jelölhetjük teljes hardeningként lezártnak.
3. Productionről titkosított, hozzáférésvédett séma+adat+szerepjogosultság és Auth-kompatibilis mentés. Free csomagon ne feltételezzetek automatikus PITR-t. Supabase backup elérhetőségének ellenőrzése; ha nincs megfelelő mentés, kontrollált CLI/pg_dump mentés szükséges. A jelszót ne tedd parancssorba/Gitbe. A visszaállítást **külön, üres izolált adatbázison** kell ténylegesen kipróbálni, számlálókkal/constraint-ekkel; ez a szolgáltatói mentési próba még nem történt meg.
4. A snapshot klónján preflight, majd kizárólag az új négy migráció és a teljes regresszió. Az eredeti történetben meglévő hiányzó registry-bejegyzéseket csak bizonyított sémaegyezés esetén, külön jóváhagyott `supabase migration repair` művelettel lehet rendezni. A reconciliation után a régi SEO migráció állapotát is ellenőrzött módon kell nyilvántartásba venni; ne futtasd rá az eredeti SQL-t. A CLI pontos repair kapcsolóit a telepített verzió `--help` kimenetéből válaszd.
5. Staging külön providerkulcsokkal: valós Turnstile, OTP, TOTP enrollment/challenge/tartalék/recovery, távoli logout, Resend, privát oldalak és mindkét nyelv. Report-Only CSP megfigyelés. Ezt a helyi provider-szimuláció nem helyettesíti.
6. **Külön production jóváhagyás után**, rövid módosítási karbantartási ablakban: új SQL-ek a megadott sorrendben, ellenőrző preflight és PostgREST séma-cache frissítés (szükség esetén `notify pgrst, 'reload schema';`), új alkalmazás és env kiadása. Régi böngészőkliensek kapjanak újratöltést; admin új bejelentkezés szükséges. Az új app a migrációk nélkül nem kompatibilis.
7. Owner első és tartalék MFA, főbb olvasási és tesztfoglalási smoke check, ellenőrzött kézbesítés, aztán a külön schedule SQL és monitorozás. Az új outbox worker indulása előtt ne maradjon régi apppéldány, amely ugyanazt a levelet közvetlenül küldi.
8. Éles séma/registry ellenőrzés, Advisor, privacy és szerepkörös smoke check; a jóváhagyott CSP enforce későbbi buildben kapcsolható. Csak ezután oldható fel minden kiadási feltétel.

Rollback sorrend:

- Tartsd meg a karbantartási írászárat. A három **új** Cron jobot név szerint állítsd le; a korábbi lejárteszköz-takarítást ne töröld. A friss audit/outbox/idempotencia sorokat exportáld védett operatív mentésbe, ne töröld őket.
- CSP-hiba esetén `CSP_MODE=report-only` + új build visszaállítja a jelentési módot; nincs szükség adatmódosításra.
- Alkalmazáshibánál az utolsó **új sémával kompatibilis** hardening buildre rollbackeljetek. A `c47e324` közvetlen visszarakása nem biztonságos: nincs benne MFA és új revision/outbox kezelés. Ilyenkor az írászár maradjon, és előre javító hotfix készüljön.
- Teljes séma-visszaállítás csak a mentett, pontos korábbi függvény-/trigger-/GRANT-definíciók és a migráció óta keletkezett foglalási delta egyeztetésével, stagingben kipróbált, külön jóváhagyott terv szerint történhet. Új oszlopot/táblát/historyt nem kell automatikusan ledobni. Régi közvetlen e-mailküldés visszaállítása előtt az outbox függő tételeit egyeztetni kell a már kiküldött Resend idempotenciakulcsokkal.
- Teljes backupot soha ne tölts vissza vakon az élő adatbázisra: a mentés óta létrejött foglalásokat előbb meg kell őrizni és össze kell fésülni. Nincs db reset, automatikus DROP vagy vendégadatvesztést engedő rollback script.

## 9. Fennmaradó korlátok és források

Nyitott: production jóváhagyás/migráció/deployment; Free csomag leaked-password védelme; provideres staging és helyreállítás; valódi mentés-visszatöltés; WAF/secret/dashboard állapot; hosted CI; valós teljesítmény- és költségmérés. A secret scanner ismert kulcsformátumokat keres szövegben és Git patch historyban; nem általános entrópia-/binárisarchívum-elemző. A helyi sikerek nem jelentenek sérthetetlenségi garanciát.

Az ESLint **9.39.5** fejlesztési függőség maradt, mert a Next 16 konfigurációjának React/import/a11y pluginjei még a 9-es peer-verziót deklarálják. Npm deprecated jelzés van, audit-riasztás nincs; futási csomagba nem kerül. Ezt az upstream plugin-kompatibilitással együtt tovább kell követni. Nem használtam `npm audit fix --force`-ot. A PostgreSQL embedded wrapper verziócímkéje béta, kizárólag QA-függőség; a tényleges tesztmotor PostgreSQL 17.12.

Ellenőrzött hivatalos források: [Next 16 migráció](https://nextjs.org/docs/pages/guides/upgrading/version-16), [16.4.6 release](https://github.com/vercel/next.js/releases/tag/v16.4.6), [Next támogatás](https://nextjs.org/support-policy), [Next security advisories](https://github.com/vercel/next.js/security/advisories), [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Auth REST specifikáció](https://github.com/supabase/auth/blob/master/openapi.yaml), [session-életciklus](https://supabase.com/docs/guides/auth/sessions), [jelszóbiztonság](https://supabase.com/docs/guides/auth/password-security), [Vercel proxyfejlécek](https://vercel.com/docs/headers/request-headers), [Turnstile Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Resend idempotencia](https://resend.com/changelog/batch-idempotency-keys). A szolgáltatói protokollokat és a telepített Next csomaghoz tartozó dokumentációt is ellenőriztem.

## 10. Módosított és hozzáadott fájlok

Az alábbi manifest a `c47e324` állapothoz képest készült. Az eredeti, már a feladat kezdetén meglévő `BIZTONSAGI_AUDIT.md` külön forrás, nem a hardening során átírt jelentés.

<!-- changed-file-manifest -->

- `.env.example`
- `.eslintrc.json` (eltávolítva / új konvencióra cserélve)
- `.github/workflows/security.yml`
- `.gitignore`
- `README.md`
- `SECURITY-HARDENING-REPORT.md`
- `components/AdminDashboard.jsx`
- `components/AdminIdentityGate.jsx`
- `components/AdminMfa.jsx`
- `components/AdminServices.jsx`
- `components/AdminStaffAccounts.jsx`
- `components/AdminTimeOff.jsx`
- `components/BookingManageList.jsx`
- `components/BookingWizard.jsx`
- `components/GuestIdentity.jsx`
- `components/TrustedDevices.jsx`
- `csp.config.cjs`
- `eslint.config.mjs`
- `lib/client/adminFetch.js`
- `lib/client/botCheck.js`
- `lib/client/translations.mjs`
- `lib/server/adminAuth.js`
- `lib/server/adminCalendar.js`
- `lib/server/bookingDb.js`
- `lib/server/bookingEmail.js`
- `lib/server/bookingManagement.js`
- `lib/server/deviceApi.js`
- `lib/server/guestAuth.js`
- `lib/server/http.js`
- `lib/server/ogImage.js`
- `lib/server/outbox.js`
- `lib/server/revision.js`
- `lib/server/security.js`
- `lib/server/staffAccounts.js`
- `lib/server/staffSettings.js`
- `lib/server/timeOff.js`
- `lib/server/trustedDevices.js`
- `middleware.js` (eltávolítva / új konvencióra cserélve)
- `next.config.js`
- `package-lock.json`
- `package.json`
- `pages/api/admin/appointment.js`
- `pages/api/admin/auth/logout.js`
- `pages/api/admin/auth/mfa.js`
- `pages/api/admin/auth/password.js`
- `pages/api/admin/auth/send-code.js`
- `pages/api/admin/auth/session.js`
- `pages/api/admin/auth/verify-code.js`
- `pages/api/admin/bookings.js`
- `pages/api/admin/calendar.js`
- `pages/api/admin/change-status.js`
- `pages/api/admin/options.js`
- `pages/api/admin/services.js`
- `pages/api/admin/settings.js`
- `pages/api/admin/staff-accounts.js`
- `pages/api/admin/statistics.js`
- `pages/api/admin/time-off.js`
- `pages/api/booking/availability.js`
- `pages/api/booking/cancel.js`
- `pages/api/booking/config.js`
- `pages/api/booking/create.js`
- `pages/api/booking/earliest.js`
- `pages/api/booking/mine.js`
- `pages/api/csp-report.js`
- `pages/api/guest/logout.js`
- `pages/api/guest/me.js`
- `pages/api/guest/profile.js`
- `pages/api/guest/send-code.js`
- `pages/api/guest/session.js`
- `pages/api/guest/verify-code.js`
- `pages/api/og.jsx`
- `pages/api/security-jobs.js`
- `proxy.js`
- `scripts/scan-secrets.mjs`
- `supabase/migrations/20261127221722_security_hardening_core.sql`
- `supabase/migrations/20261127221728_security_hardening_auth.sql`
- `supabase/migrations/20261127221729_security_hardening_outbox.sql`
- `supabase/migrations/20261127222902_reconcile_public_seo_profiles.sql`
- `supabase/sql/security_hardening_preflight.sql`
- `supabase/sql/security_hardening_schedule.sql`
- `tests/admin-auth-separation.test.mjs`
- `tests/admin-dashboard.test.mjs`
- `tests/admin-responsive.browser.mjs`
- `tests/auth-provider.http.mjs`
- `tests/booking.test.mjs`
- `tests/calendar.browser.mjs`
- `tests/database.integration.mjs`
- `tests/earliest-booking.browser.mjs`
- `tests/fixtures/auth-fetch.cjs`
- `tests/fixtures/public-seo-fetch.cjs`
- `tests/hardening.test.mjs`
- `tests/home-booking.browser.mjs`
- `tests/public-booking.browser.mjs`
- `tests/salon-admin.test.mjs`
- `tests/security.browser.mjs`
- `tests/security.database.mjs`
- `tests/security.http.mjs`
- `tests/seo.browser.mjs`
- `tests/staff-accounts.test.mjs`
- `tests/staff-isolation.browser.mjs`
- `tests/staff-services.browser.mjs`
- `tests/staff-services.test.mjs`
- `tests/team-selection.browser.mjs`
- `tests/trusted-devices.test.mjs`
