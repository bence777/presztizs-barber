import {TEAM} from './team.mjs';
// Public notice content only. Do not fill these fields from private staff/Auth data.
// The notice remains a draft until the controller and actual retention/transfer
// arrangements have been supplied and reviewed. Status is not inferred from dates.
export const PRIVACY = Object.freeze({
  status: 'draft', version: '2026-11-28', effectiveDate: '',
  barbers: TEAM.map(({id,name})=>({staffId:id,displayName:name,name:'',address:'',email:''})),
  review: { retention: false, providers: false, rolesAndLegalBases: false },
  controller: { name: '', address: '', email: '', registration: '', dpo: '' },
});
export const PRIVACY_SOURCES = [
  ['GDPR', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj'],
  ['EDPB – individual rights', 'https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en'],
  ['NAIH', 'https://www.naih.hu/ugyfelszolgalat-kapcsolat'],
  ['Supabase DPA', 'https://supabase.com/legal/customer-resources/data-processing-addendum'],
  ['Vercel privacy', 'https://vercel.com/legal/privacy-notice'],
  ['Resend DPA', 'https://resend.com/legal/dpa'],
  ['Cloudflare Turnstile Privacy Addendum', 'https://www.cloudflare.com/turnstile-privacy-policy/'],
  ['Google Maps privacy','https://policies.google.com/privacy'],
  ['Unsplash privacy', 'https://unsplash.com/privacy'],
];
export function privacyPublishable(config = PRIVACY) {
  return config.barbers?.length>0 && config.barbers.every(b=>b.name&&b.address&&b.email) && config.status === 'approved' && Object.values(config.review||{}).length===3 && Object.values(config.review).every(Boolean) && Boolean(config.effectiveDate && config.controller.name && config.controller.address && config.controller.email);
}
const hu = {
  title: 'Adatvédelmi tájékoztató', description: 'A DEMETERS weboldalának és időpontfoglalási rendszerének adatkezelése, sütijei és az érintetti jogok.',
  draft: 'Egyeztetési tervezet. Az adatkezelő adatai és a megjelölt megőrzési, szolgáltatói feltételek véglegesítéséig nem hatályos tájékoztató.',
  date: 'Tervezet dátuma', effective: 'Hatálybalépés', pending: 'Véglegesítendő', contents: 'Tartalom', print: 'Nyomtatás / mentés PDF-ként',
  controllerTitle: '1. Adatkezelő fodrászok és foglalóüzemeltető',
  operatorTitle: 'A foglalórendszer üzemeltetője',
  directoryTitle: 'Önálló adatkezelő fodrászok',
  directoryHeadings: ['Fodrász a weboldalon','Vállalkozó hivatalos neve','Székhely / postacím','Adatvédelmi kapcsolattartás'],
  controllerLabels: { name: 'Foglalóüzemeltető hivatalos neve', address: 'Székhely / levelezési cím', email: 'Adatvédelmi kapcsolattartás', registration: 'Nyilvántartási adatok, ha alkalmazandók', dpo: 'Adatvédelmi tisztviselő elérhetősége, ha kijelölték' },
  controllerIntro: 'Ez a tájékoztató a demeters.hu látogatóira, az online vagy a szalonnál rögzített foglalások vendégeire, valamint a foglalási rendszer kezelőire vonatkozik. A DEMETERS márkanév önmagában nem azonosítja az adatkezelő vállalkozást.',
  controllerRole: 'A fodrászok külön vállalkozóként, önálló adatkezelőként kezelik a saját szolgáltatásukhoz kapcsolódó foglalási és vendégadatokat. Az adott foglalás adatkezelője a választott fodrász vállalkozása. A közös felület nem teszi őket automatikusan közös adatkezelővé. A foglalóüzemeltető a fodrászok utasítására végzett technikai műveleteknél adatfeldolgozóként járhat el; az esetleges saját célú, külön adatkezelését és a szerződéses feladatmegosztást még meg kell nevezni. Az alábbi megjelenítési nevek nem helyettesítik a vállalkozók hivatalos adatait.',
  sections: [
    { id: 'adatok', title: '2. Milyen adatokat kezelünk, és honnan származnak?', paragraphs: [
      'Online azonosításkor az e-mail-címedet, majd a nevedet és telefonszámodat kéred a rendszerhez kapcsolni. Foglaláskor a választott fodrász, szolgáltatás, nap, kezdés, időtartam, ár, foglalási azonosító és állapot is rögzül. A lemondás, módosítás, teljesítés vagy meg nem jelenés adata szintén kapcsolódhat a foglaláshoz.',
      'Telefonon vagy személyesen kért időpontot a jogosult szalonkezelő rögzíthet. Ilyenkor az adatok a vendégtől, illetve a kérést továbbító személytől kerülnek a rendszerbe; egy manuális foglalás névvel, e-mail és telefonszám nélkül is létrehozható. Más személy adatait csak megfelelő felhatalmazással add meg. Az ilyen vendég is megkapja a tájékoztatást az első releváns kapcsolatfelvételig vagy adattovábbításig, de legkésőbb egy hónapon belül, az alkalmazandó jogszabályi kivételekkel.',
      'A bejelentkezést technikai felhasználó- és munkamenet-azonosítók, eszközelnevezés, létrehozási/utolsó használati/lejárati idő és véletlen eszközhitelesítő védik. Az eszköznyilvántartás a hitelesítő lenyomatát tárolja. A rendszer és szolgáltatói a működéshez IP-címet, kérésadatokat, böngészőjellemzőket és biztonsági eseményeket is feldolgozhatnak.',
      'Az online foglaló nem kér bankkártyaadatot, személyazonosító okmányt, születési dátumot vagy egészségügyi adatot. Szabad szövegben se adj meg ilyen, a foglaláshoz nem szükséges adatot. A számlázás, helyszíni fizetés és esetleges kamerás megfigyelés nem e foglaló funkciója; ezekhez szükség esetén külön tájékoztatás tartozik.'
    ] },
    { id: 'celok', title: '3. Célok és jogalapok', table: {
      headings: ['Adatkezelés', 'Cél és érintett adatok', 'Jogalap'], rows: [
        ['Weboldal megjelenítése', 'IP- és kérésadatok a weboldal és a választott képi tartalmak kiszolgálásához.', 'GDPR 6. cikk (1) f): az elérhető, működő weboldalhoz fűződő jogos érdek, szükséges és arányos adatkezeléssel.'],
        ['Időpontfoglalás és kapcsolattartás', 'Név, e-mail, telefonszám, szolgáltatás és időpont: egyeztetés, módosítás, lemondás, visszaigazolás és a kért szolgáltatás megszervezése.', 'GDPR 6. cikk (1) b): szerződés előkészítése / teljesítése.'],
        ['Vendégazonosítás és profil', 'E-mailes kód, felhasználói azonosító és kapcsolati adatok: saját foglalások biztonságos elérése, az ismételt adatmegadás megkönnyítése.', 'GDPR 6. cikk (1) b): a kért online foglalási és profilfunkció teljesítése.'],
        ['Opcionális eszközmegjegyzés', 'Külön választott tartós bejelentkezés. Kikapcsolása nem akadálya az egyszeri foglalásnak.', 'GDPR 6. cikk (1) a): a külön megadott, visszavonható hozzájárulás.'],
        ['Biztonság és visszaélésvédelem', 'Hozzáférési események, kérésazonosítók, korlátozási számlálók és botellenőrzés: illetéktelen hozzáférés, automatizált levelezés és naptárfeltöltés megelőzése.', 'GDPR 6. cikk (1) f): a rendszer és az érintettek adatainak védelméhez fűződő jogos érdek.'],
        ['Kezelői hozzáférés', 'Fodrászhoz kapcsolt azonosító, kezelői e-mail, jogosultság, biztonsági és hitelesítési adatok: a saját munka szervezése, hozzáférések kiosztása és visszavonása.', 'Az együttműködéshez szükséges körben 6. cikk (1) b); a hozzáférésvédelemnél 6. cikk (1) f).'],
        ['Érintetti megkeresések', 'Kérelem, válasz és a szükséges azonosítás adatai: adatvédelmi jogok gyakorlásának intézése.', 'GDPR 6. cikk (1) c): adatvédelmi kötelezettségek teljesítése.'],
        ['Konkrét jogvita', 'Csak a meghatározott igényhez szükséges foglalási vagy kommunikációs bizonyíték, elkülönített hozzáféréssel.', 'GDPR 6. cikk (1) f): jogi igény előterjesztése, érvényesítése vagy védelme.']
      ] }, paragraphs: ['A foglaláshoz szükséges adatkezelést nem kötjük általános „adatvédelmi hozzájárulás” jelölőnégyzethez. Az e-mailes belépőkód és a foglalási értesítő szolgáltatási üzenet, nem hírlevél. Marketingküldéshez ez a tájékoztató és a foglalás önmagában nem ad felhatalmazást. A jogos érdeken alapuló műveletekhez tartozó érdekmérlegelést az adatkezelőnek külön dokumentálnia kell.'] },
    { id: 'kotelezo', title: '4. Kötelező és választható adatok', paragraphs: [
      'Online foglaláshoz e-mailes azonosítás, név és használható telefonszám szükséges. Ezek nélkül az online véglegesítés nem használható; a szalonnal más csatornán történő egyeztetés lehetőségéről a szalonnál érdeklődhetsz. A tartós eszközmegjegyzés külön választható, alapértelmezésben nincs bekapcsolva.',
      'A foglalási állapot nem helyettesíti a számlát, és a telefonszámot vagy e-mail-címet nem hozzuk nyilvánosságra a szabad időpontok között. A fodrász, illetve jogosult közreműködő csak a feladatához és jogosultságához szükséges adatot ismerheti meg.'
    ] },
    { id: 'hozzaferes', title: '5. Kik férhetnek hozzá?', paragraphs: [
      'A vendég a saját, ellenőrzött azonosságához kapcsolt adatokat és foglalásokat érheti el. A fodrász a saját jogosultsági körébe tartozó időpontokat, kapcsolati adatokat és beállításokat kezeli. A főadmin technikailag szélesebb hozzáféréssel rendelkezik. E hozzáférést a vállalkozó fodrászokkal rendezett adatfeldolgozói feladatokhoz, szükségességhez és titoktartáshoz kell kötni; a technikai jogosultság önmagában nem jogalap más célú adatfelhasználásra. Az infrastruktúra-üzemeltető és támogatást nyújtó közreműködő csak a szükséges körben, megfelelő kötelezettségekkel járhat el.',
      'Foglalási e-mailt a vendég és az érintett fodrász, illetve a kijelölt szalonkapcsolat kaphat. Hatóságnak vagy más címzettnek csak megfelelő jogalappal továbbítható adat. Másik fodrásznak történő átadásnak külön jogalap és szükség esetén a vendég előzetes tájékoztatása kell; a közös rendszerből nem következik szabad közös vendéglista. A foglalás más vállalkozóhoz való áthelyezését ennek megfelelően kell kezelni.'
    ] },
    { id: 'szolgaltatok', title: '6. Technikai szolgáltatók és külső tartalmak', table: {
      headings: ['Szolgáltató', 'Feladat és adatfajták'], rows: [
        ['Supabase – Supabase Pte. Ltd.', 'Adatbázis és belépés: profil, foglalás, kezelői szerep, hitelesítés, eszközök és biztonsági adatok. Az adatbázis kiválasztott régiója Frankfurt (EU); ez önmagában nem zárja ki más országban végzett támogatási vagy alfeldolgozói műveleteket.'],
        ['Vercel – Vercel Inc.', 'Weboldal és API kiszolgálása: hálózati/kérésadatok, IP-cím, biztonsági és működési naplók; a foglalási kérések szerveroldali feldolgozása.'],
        ['Resend – Plus Five Five, Inc.', 'Foglalási és állapotváltozási e-mailek kézbesítése: címzett, üzenettartalom, kézbesítési metaadat. A belépőkódok a Supabase Auth és a beállított SMTP-szolgáltató útján érkeznek.'],
        ['Cloudflare – Cloudflare, Inc. (Turnstile)', 'Bekapcsolt botellenőrzésnél IP-cím, böngésző-/hálózati biztonsági jelek és ellenőrző token. A Cloudflare a webhely védelménél adatfeldolgozó, saját botvédelmi technológiájának fejlesztésénél önálló adatkezelő is lehet; lásd a Turnstile Privacy Addendumot.'],
        ['Unsplash és a tényleges külső képkiszolgálók', 'Külső kép betöltésekor a böngésző közvetlenül a kép tárhelyéhez fordul; ez IP-cím és szokásos hálózati/kérésadatok átadásával járhat. A portfólióban megadott kép URL-jének tárhelye is lehet ilyen címzett.'],
        ['SMTP-szolgáltató – VÉGLEGESÍTENDŐ', 'A tényleges Supabase SMTP-beállítás szerinti vállalkozás neve, adatkezelési feltételei és megőrzése még rögzítendő.']
      ] }, paragraphs: ['A pontos szerződő jogi személyt, adatfeldolgozói szerződéseket, ténylegesen aktív funkciókat, alfeldolgozókat és szolgáltatói naplómegőrzést az üzemeltetőnek a közzététel előtt ellenőriznie kell. A szolgáltatói feltételek hivatkozásai a tájékoztató végén találhatók. Közösségi vagy térképes hivatkozás megnyitása után az adott külső oldal saját tájékoztatója is alkalmazandó.'] },
    { id: 'kulfoldd', title: '7. EU-n kívüli adatkezelés', paragraphs: [
      'Egyes szolgáltatók az Európai Gazdasági Térségen kívül működnek, vagy onnan is nyújthatnak támogatást. EU-s szerverrégió választása nem jelent minden címzettre kiterjedő EU-n belüli adatkezelési garanciát. A tényleges továbbításokhoz megfelelő garancia szükséges, például alkalmazható megfelelőségi határozat vagy általános szerződési feltétel és szükség esetén kiegészítő intézkedés.',
      'VÉGLEGESÍTENDŐ: szolgáltatónként a tényleges célország, jogalap/garancia és az alkalmazandó feltételek hozzáférhetősége. A szolgáltató honlapján elérhető DPA puszta belinkelése nem igazolja automatikusan a DEMETERS saját szerződéses és továbbítási feltételeit. A garanciák másolatáról vagy elérhetőségéről az adatkezelőnél kérhetsz tájékoztatást.'
    ] },
    { id: 'megorzes', title: '8. Meddig őrizzük az adatokat?', paragraphs: [
      'A lejáró bejelentkezés nem jelenti a vendégprofil vagy a foglalási előzmény törlését. A vendégprofil és a foglalási kapcsolati adatok általános törlési/anonimizálási határideje még nincs véglegesítve; a jelenlegi kódra nem lehet automatikus, meghatározott idejű törlést ígérni. A határidőt és a tényleges végrehajtást a közzététel előtt össze kell hangolni.',
      'Az alábbi technikai időtartamok az előkészített biztonsági kiadáshoz tartoznak. A lejárati korlátok és a takarítófolyamat által végzett fizikai törlés eltérhetnek: az utóbbi a következő sikeres ütemezett futáskor történik. A még nem aktivált funkciók és ütemezések működését a hatálybalépés előtt ellenőrizni kell.'
    ], table: { headings: ['Adatkör', 'Időtartam / törlési feltétel'], rows: [
      ['Vendégprofil és hitelesítési fiók', 'A kért profilfunkcióhoz szükséges ideig; az inaktív fiókok és kapcsolati adatok konkrét felülvizsgálati/törlési határideje VÉGLEGESÍTENDŐ.'],
      ['Foglalási előzmény és kapcsolati másolat', 'A szolgáltatás megszervezéséhez, majd a dokumentált utólagos célhoz szükséges ideig. Az általános megőrzési maximum VÉGLEGESÍTENDŐ; külön konkrét jogvita esetén csak az igényhez szükséges adat őrizhető tovább.'],
      ['Vendég bejelentkezési eszköz', 'Megjegyzés nélkül legfeljebb 12 óra, böngészős munkamenetsüti. Megjegyzéssel minden ellenőrzött használat legfeljebb újabb 60 napra hosszabbíthat. Eszközvisszavonás vagy kijelentkezés előbb megszüntetheti.'],
      ['Admin munkamenet', 'A biztonsági kiadás alapbeállítása legfeljebb 24 óra abszolút és 30 perc inaktivitás; ideiglenes belépésnél rövidebb korlát is lehet. A cookie technikai lejárata hosszabb lehet, de önmagában nem ad hosszabb hozzáférést.'],
      ['Visszaélési számláló és token-lenyomat', 'A vonatkozó rövid korlátozási ablak lejárta után egy órás pufferrel takarítható. Az alkalmazás számlálói nyers IP/e-mail helyett titkos kulccsal képzett lenyomatot használnak.'],
      ['Ismételt foglalás felismerése', 'A felhasználóhoz kötött idempotenciabejegyzés létrehozásától 7 nap, majd ütemezett törlés.'],
      ['Értesítési feladatok', 'Belépőkód küldési feladat 15 perc után takarítható. Sikeres foglalási levél tartalma a küldéstől 7 nap, más megőrzött tartalom legfeljebb a feladat létrehozásától 30 nap után ürül. Operatív metaadat 90 nap után takarítható. A levelezőszolgáltató saját másolatai külön szabály alá esnek.'],
      ['Admin műveleti audit', '365 nap, majd ütemezett törlés; kapcsolati értékek, jelszavak és ellenőrző kódok nélkül. A személyhez kapcsolható műveletazonosító ettől még személyes adat lehet.'],
      ['Joggyakorlási levelezés, szervernapló és mentés', 'Az adatkezelő tényleges panasz-/kérelemkezelési, szolgáltatói napló- és mentési rendje szerint; az időtartamok és a visszaállítás utáni törlésismétlés VÉGLEGESÍTENDŐ.']
    ] } },
    { id: 'sutik', title: '9. Sütik és böngészőtárhely', paragraphs: [
      'A belépéshez szükséges cookie-k a saját böngészőmunkamenetedet azonosítják. Nem reklámcélúak. A „Megjegyzés” választást külön kérjük; megosztott eszközön ne kapcsold be. A sütik törölhetők a böngészőben, a megbízható eszköz pedig a saját eszközlistában is visszavonható. A cookie törlése önmagában nem törli a szerveren tárolt profilt vagy foglalást.',
      'A helyi tárhelyen tárolt nyelvválasztás nem követi a böngészést. Az ismételt foglalást megelőző munkamenettárhely-bejegyzés technikai kulcsot és a választott szolgáltatás/fodrász/nap/idő azonosítóit tartalmazza, nevet, telefonszámot, e-mail-címet vagy belépési tokent nem.'
    ], table: { headings: ['Név', 'Rendeltetés', 'Böngészőbeli élettartam'], rows: [
      ['pb_access, pb_refresh, pb_device_until, pb_trusted_device', 'Vendégazonosítás és eszközmegjegyzés; HttpOnly cookie-k. Az alapbelépés a kért funkcióhoz szükséges, a tartós megjegyzés külön választás.', 'Megjegyzés nélkül munkamenetsüti (szerveres jogosultság legfeljebb 12h); megjegyzéssel használatonként legfeljebb újabb 60 nap.'],
      ['pb_admin_access, pb_admin_refresh, pb_admin_until, pb_admin_trusted_device', 'Külön kezelői bejelentkezés; HttpOnly cookie-k. A vendégcookie nem ad adminjogot.', 'Munkamenetsüti vagy technikailag legfeljebb 7 napos cookie; a szerveroldali 24h/30 perc alapkorlát ettől függetlenül rövidebb hozzáférést érvényesít.'],
      ['demeters-language (localStorage)', 'Kért HU/EN nyelvválasztás, funkcionális beállítás.', 'Böngészőadatok törléséig vagy a beállítás felülírásáig.'],
      ['demeters-booking-intent (sessionStorage)', 'Hálózati újrapróbánál ugyanazon foglalási szándék felismerése.', 'Sikeres foglalásig, a bejegyzés cseréjéig vagy a böngésző munkamenettárhelyének megszűnéséig.']
    ] } },
    { id: 'kovetes', title: '10. Botvédelem, analitika és marketing', paragraphs: [
      'A cím megjelenítéséhez beágyazott Google Térképet használunk. A térkép betöltésekor a böngésző a Google szervereihez kapcsolódik, ami IP-cím és technikai kérésadatok átadásával járhat. Részletek a Google adatvédelmi tájékoztatójában.',
      'A bekapcsolt Turnstile a belépőkódkérés és jelszavas belépés során, az adott művelet kezdeményezésekor töltődik be. A honlap saját eszközlistája nem tárol teljes böngészőazonosítót vagy hardverujjlenyomatot; ettől függetlenül a Cloudflare a botellenőrzéshez technikai böngésző- és hálózati jeleket dolgozhat fel. Részletek a Cloudflare Turnstile Privacy Addendumban.',
      'A jelenlegi alkalmazáskód nem telepít Google Analytics, Meta Pixel vagy más marketingkövetőt. A belső analitikai eseménysegéd alapértelmezésben kikapcsolt, és önmagában nem küld adatot külső hálózati címre. Új mérőeszköz vagy hirdetési követő bevezetésekor előzetes, külön tájékoztatás és ahol szükséges, hozzájárulás kell. A tárhely- és levelezőszolgáltatói dashboardon külön bekapcsolható analitika/követés állapotát a közzététel előtt ellenőrizni kell.'
    ] },
    { id: 'jogok', title: '11. Milyen jogaid vannak?', paragraphs: [
      'Az adatkezelőtől tájékoztatást és hozzáférést, helyesbítést, a feltételek fennállásakor törlést vagy korlátozást kérhetsz. Szerződésen vagy hozzájáruláson alapuló automatizált adatkezelésnél adathordozhatóság is megillethet. A jogos érdeken alapuló művelet ellen a saját helyzeteddel kapcsolatos okból tiltakozhatsz.',
      'Hozzájárulásodat bármikor visszavonhatod, a korábbi jogszerű műveletek sérelme nélkül. Az eszközmegjegyzést az eszköz visszavonásával vagy kijelentkezéssel szüntetheted meg. A foglalás lemondása nem azonos a profil törlésével. Törléskor a további tárolás jogalapját külön kell vizsgálni; azonosítható adat szükség nélkül nem őrizhető meg.'
    ] },
    { id: 'kerelem', title: '12. Hogyan kérhetsz hozzáférést vagy törlést?', paragraphs: [
      'Kérelmedet az érintett fodrász 1. pontban megadott adatvédelmi elérhetőségére küldheted; jelöld meg a kért intézkedést, a foglalásnál használt címet és lehetőség szerint a fodrászt vagy foglalást. A foglalóüzemeltetőhöz érkező kérelmet az illetékes adatkezelőhöz kell irányítani és a saját adatfeldolgozói feladatkörében támogatni. Jelezheted, ha a teljes közös profilodra vonatkozik a kérés; több önálló adatkezelő érintettségét külön egyeztetni kell. Ne küldj jelszót, belépőkódot vagy teljes okmánymásolatot; azonosításhoz csak az indokolt többletadatot kérhetjük.',
      'Főszabály szerint egy hónapon belül válaszolunk. Összetett vagy nagyszámú kérelemnél további két hónap hosszabbítás lehetséges, amelyről az első hónapon belül, indokolással tájékoztatunk. A kérelmezés főszabály szerint díjmentes; az elutasításnak vagy kivételes díjnak indokolható jogszabályi feltétele van. Ha más címzettnek is továbbított adatot kell helyesbíteni vagy törölni, a szükséges értesítésről is gondoskodni kell.'
    ] },
    { id: 'dontes', title: '13. Automatizált korlátozás és adatbiztonság', paragraphs: [
      'A rendszer automatikusan vizsgálja az időpontütközést, a munkaidőt, a foglalási kvótát és a túl sűrű kéréseket; a botellenőrzés is visszautasíthat egy próbálkozást. Ezek technikai védelmek, nem reklám- vagy fizetőképességi profilalkotásra szolgálnak. Hibásnak tartott korlátozás esetén kérj emberi felülvizsgálatot a szalontól. A megadott adatok alapján nem tervezünk a GDPR 22. cikke szerinti, kizárólag automatizált, joghatással vagy hasonlóan jelentős hatással járó döntést.',
      'A hozzáférést kódos azonosítás, jogosultsági elkülönítés, biztonságos munkamenetek és a kezelőknél kiegészítő védelem korlátozza. Adatvédelmi incidensnél az adatkezelőnek értékelnie kell az érintettek kockázatát és a vonatkozó értesítési kötelezettségeket. A technikai védelem nem jelent teljes sérthetetlenségi garanciát.'
    ] },
    { id: 'kepek', title: '14. Nyilvános fodrászprofilok és portfólió', paragraphs: [
      'A nyilvános profil a fodrász nevét, bemutatkozását, közzétételre szánt szakmai adatait és képeit tartalmazhatja. Vendégről készült azonosítható fotó közzétételéhez külön megfelelő jogalap és a képmáshoz fűződő jogok rendezése szükséges. A foglalás vagy e tájékoztató megismerése önmagában nem fotóközlési hozzájárulás. A publikálás konkrét feltételeit a szalonnal külön kell egyeztetni.'
    ] },
    { id: 'panasz', title: '15. Panasz és jogorvoslat', paragraphs: [
      'Panaszoddal az adatkezelőhöz és a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH) fordulhatsz, illetve bírósági jogorvoslatot vehetsz igénybe. NAIH: 1055 Budapest, Falk Miksa utca 9–11.; postacím: 1363 Budapest, Pf. 9.; telefon: +36 (1) 391 1400.',
      'A naih.hu ügyintézési tájékoztatóján találod a hivatalos benyújtási csatornákat. Az ugyfelszolgalat@naih.hu tájékozódási elérhetőség; a Hatóság tájékoztatása szerint egyszerű e-maillel hatósági eljárás nem indítható. A jogorvoslatnak nem feltétele, hogy előbb a szalontól kérj megoldást.'
    ], links: [['NAIH – kapcsolat és ügyintézés', 'https://www.naih.hu/ugyfelszolgalat-kapcsolat']] },
    { id: 'valtozas', title: '16. Változások és kapcsolódó források', paragraphs: [
      'A tájékoztató változását verzióval és hatálybalépési dátummal jelezzük; új célról vagy lényeges változásról az adatkezelés megkezdése előtt tájékoztatást kell adni. A tájékoztató egyoldalú módosítása nem pótolja az új jogalapot vagy a szükséges hozzájárulást.'
    ], links: PRIVACY_SOURCES }
  ],
};
const en = {
  title: 'Privacy notice', description: 'How the DEMETERS website and appointment system handle personal data, cookies and your rights.',
  draft: 'Draft for review. This is not an effective privacy notice until the controller details and the marked retention and provider arrangements have been finalised.',
  date: 'Draft date', effective: 'Effective from', pending: 'To be confirmed', contents: 'Contents', print: 'Print / save as PDF',
  controllerTitle: '1. Independent barber controllers and platform operator',
  operatorTitle: 'Booking platform operator',
  directoryTitle: 'Independent barber controllers',
  directoryHeadings: ['Barber displayed on the website','Full legal business name','Registered / postal address','Privacy contact'],
  controllerLabels: { name: 'Full legal name of the platform operator', address: 'Registered / postal address', email: 'Privacy contact', registration: 'Registration details, if applicable', dpo: 'Data protection officer contact, if appointed' },
  controllerIntro: 'This notice covers visitors to demeters.hu, guests whose appointments are booked online or entered by the salon, and users of the management system. The DEMETERS brand alone does not identify the legal entity responsible for processing.',
  controllerRole: 'Barbers work as separate businesses and act as independent controllers for bookings and guest data relating to their own services. The controller for an appointment is the selected barber’s business. Sharing a booking interface does not automatically make them joint controllers. The platform operator may act as a processor for technical operations carried out on the barbers’ instructions; any separate own-purpose processing and contractual responsibilities still need to be specified. Display names below do not replace the businesses’ legal identities.',
  sections: [
    { id: 'adatok', title: '2. Data we process and its sources', paragraphs: [
      'Online identification uses your email address. The guest profile also records your name and phone number. An appointment records the selected barber and service, date, start time, duration, price, booking identifier and status, including relevant changes, cancellation, completion or non-attendance.',
      'An authorised salon manager can enter an appointment requested by phone or in person. Details then come from the guest or a person conveying their request; a manual appointment can be entered with a name without an email address or phone number. Supply someone else’s data only with appropriate authority. Where data is obtained indirectly, information must be given at the first relevant communication or disclosure, and at the latest within one month, subject to applicable legal exceptions.',
      'Login uses user and session identifiers, a coarse device label, creation/last-use/expiry times and a random device credential. The device registry stores a digest of that credential. The application and infrastructure providers may also process IP addresses, request information, browser signals and security events.',
      'The booking form does not request payment card details, identity documents, date of birth or health information. Do not place unnecessary sensitive information in free-text fields. Invoicing, in-salon payments and any CCTV are outside this booking feature and require their own information where applicable.'
    ] },
    { id: 'celok', title: '3. Purposes and legal bases', table: { headings: ['Processing', 'Purpose and data', 'Legal basis'], rows: [
      ['Website delivery', 'IP/request information to deliver the website and selected image content.', 'Article 6(1)(f): legitimate interests in providing an accessible, functioning website, subject to necessity and proportionality.'],
      ['Appointments and contact', 'Name, email, phone and appointment details to organise the requested service, confirm it, and handle changes or cancellation.', 'GDPR Article 6(1)(b): steps towards and performance of a contract.'],
      ['Guest identification and profile', 'Email verification, user identifier and contact details to access your own bookings securely and avoid repeated entry.', 'Article 6(1)(b): providing the requested online booking/profile functionality.'],
      ['Optional remembered login', 'Persistent login chosen separately. Declining it does not prevent a one-off booking.', 'Article 6(1)(a): separately given, withdrawable consent.'],
      ['Security and abuse prevention', 'Access events, request identifiers, rate counters and bot checks to prevent unauthorised access, automated email abuse and calendar flooding.', 'Article 6(1)(f): legitimate interests in protecting the service and individuals’ data.'],
      ['Management accounts', 'Barber-linked identifier, management email, role and authentication/security information to organise work and grant or revoke access.', 'Article 6(1)(b) for the necessary cooperation arrangements; Article 6(1)(f) for access security.'],
      ['Data protection requests', 'Request, response and necessary identity checks to facilitate privacy rights.', 'Article 6(1)(c): compliance with data protection obligations.'],
      ['A specific legal dispute', 'Only the booking or communication evidence necessary for the particular claim, with restricted access.', 'Article 6(1)(f): establishing, exercising or defending legal claims.']
    ] }, paragraphs: ['Processing necessary for a booking does not require a blanket “privacy consent” checkbox. Verification codes and booking messages are service communications, not a newsletter. Neither a booking nor this notice authorises marketing emails. The controller must separately document the balancing assessment for legitimate-interest processing.'] },
    { id: 'kotelezo', title: '4. Required and optional information', paragraphs: [
      'Online confirmation requires email verification, a name and a usable phone number. Without them, online booking cannot be completed; ask the salon about arranging an appointment through another channel. Remembered login is optional and is off by default.',
      'A booking status is not an invoice. Guest phone numbers and email addresses are not published with available time slots. Each barber and authorised support person may access only the information necessary for their duties and permissions.'
    ] },
    { id: 'hozzaferes', title: '5. Who may access your information?', paragraphs: [
      'Guests access data and bookings linked to their verified identity. Barbers manage appointments, contact details and settings within their own authorised scope. The main administrator has broader technical permissions. These must be limited to necessary, confidential processing tasks agreed with the independent businesses; technical access alone does not authorise reuse for another purpose. Infrastructure and support providers may act only within the necessary scope and subject to appropriate obligations.',
      'Booking messages may be sent to the guest and the relevant barber or designated salon contact. Other disclosure, including to authorities, requires an appropriate legal basis. Disclosure to another barber needs its own basis and any required prior information. A shared system does not create a freely shared customer list; moving an appointment to another business must respect this distinction.'
    ] },
    { id: 'szolgaltatok', title: '6. Infrastructure providers and external content', table: { headings: ['Provider', 'Function and data'], rows: [
      ['Supabase – Supabase Pte. Ltd.', 'Database and authentication: profiles, bookings, management roles, login, devices and security information. The database region is Frankfurt (EU); this alone does not rule out support or subprocessing elsewhere.'],
      ['Vercel – Vercel Inc.', 'Website/API hosting and request processing: network/request information, IP addresses and operational/security logs, including server-side booking requests.'],
      ['Resend – Plus Five Five, Inc.', 'Booking and change notifications: recipient, message content and delivery metadata. Login codes are delivered through Supabase Auth and its configured SMTP provider.'],
      ['Cloudflare – Cloudflare, Inc. (Turnstile)', 'When enabled: IP address, browser/network security signals and a verification token. Cloudflare acts as a processor for website protection and may act as a separate controller for improving its bot-detection technology; see the Turnstile Privacy Addendum.'],
      ['Unsplash and actual external image hosts', 'A browser loading an externally hosted image contacts that host directly, which may disclose its IP address and normal network/request information. Hosts of portfolio image URLs can also be recipients.'],
      ['SMTP provider – TO BE CONFIRMED', 'The actual legal entity, processing terms and retention must be entered based on the configured Supabase SMTP service.']
    ] }, paragraphs: ['Before publication, the operator must verify the actual contracting entities, processing agreements, enabled features, subprocessors and provider log retention. Provider terms are linked below. Following a social media or map link also brings the external service’s own notice into scope.'] },
    { id: 'kulfoldd', title: '7. Processing outside the EEA', paragraphs: [
      'Some providers operate outside the European Economic Area or may provide support from there. Selecting an EU server region does not guarantee that all recipients process data only within the EU. Actual transfers require appropriate safeguards, such as an applicable adequacy decision or standard contractual clauses and any necessary additional measures.',
      'TO BE CONFIRMED for each provider: destination countries, applicable transfer mechanism/safeguards and access to the relevant terms. Merely linking a provider’s DPA does not establish the arrangements for DEMETERS’ own account. You may request information about, or access to, the applicable safeguards from the controller.'
    ] },
    { id: 'megorzes', title: '8. Retention', paragraphs: [
      'Expiry of a login does not delete the guest profile or booking history. General deletion/anonymisation periods for guest accounts and booking contact details have not yet been finalised. The current code does not support a promise of automatic deletion within a set general period. The approved retention schedule and actual deletion process must be aligned before publication.',
      'The following technical periods describe the prepared security release. Access expiry and physical cleanup are different: scheduled deletion takes place on the next successful cleanup run. Features and schedules not yet activated must be checked before this notice becomes effective.'
    ], table: { headings: ['Data', 'Period / deletion condition'], rows: [
      ['Guest profile and authentication account', 'While necessary for the requested profile feature. The review/deletion period for inactive accounts and contact details is TO BE CONFIRMED.'],
      ['Booking history and contact snapshot', 'For organising the service and the documented subsequent purpose. A general maximum is TO BE CONFIRMED; a specific legal dispute may justify retaining only the evidence required for that claim.'],
      ['Guest login/device', 'Without “remember”: browser-session cookies and up to 12 hours of server access. With “remember”: each verified use may extend access for another 60 days. Logout or device revocation can end access earlier.'],
      ['Management session', 'Security-release defaults: a 24-hour absolute maximum and 30-minute idle limit; temporary access may be shorter. A longer technical cookie lifetime does not grant longer server-side access.'],
      ['Abuse counters and token digests', 'Eligible for cleanup after the relevant short limit window plus a one-hour buffer. Application counters use keyed digests instead of raw IP addresses/email addresses.'],
      ['Duplicate-booking recognition', 'User-scoped idempotency entries: seven days from creation, followed by scheduled deletion.'],
      ['Notification tasks', 'Login-code dispatch tasks are eligible for cleanup after 15 minutes. Sent booking-message content is cleared seven days after sending; other retained content is cleared no later than 30 days after task creation. Operational metadata is eligible for cleanup after 90 days. Provider-side copies have separate retention rules.'],
      ['Management audit', '365 days, then scheduled deletion. It contains no contact values, passwords or verification codes; person-linked action identifiers may still be personal data.'],
      ['Rights correspondence, server logs and backups', 'According to the actual request-handling, provider-log and backup arrangements. Periods and reapplying deletion after restoration are TO BE CONFIRMED.']
    ] } },
    { id: 'sutik', title: '9. Cookies and browser storage', paragraphs: [
      'Login cookies identify your browser session and are not used for advertising. Remembered login is a separate choice; avoid it on shared devices. Cookies can be removed in your browser and trusted devices can also be revoked from your device list. Deleting a cookie alone does not erase the server-side profile or appointments.',
      'The stored language preference does not track browsing. The session-storage entry used to recognise a retried booking contains a technical key and the selected service/barber/date/time identifiers, not a name, phone number, email address or login token.'
    ], table: { headings: ['Name', 'Purpose', 'Browser lifetime'], rows: [
      ['pb_access, pb_refresh, pb_device_until, pb_trusted_device', 'Guest identification and remembered login; HttpOnly cookies. Basic access supports the requested feature; persistence is a separate choice.', 'Without “remember”: browser-session cookies (server access up to 12h). With “remember”: up to a further 60 days per verified use.'],
      ['pb_admin_access, pb_admin_refresh, pb_admin_until, pb_admin_trusted_device', 'Separate management login; HttpOnly cookies. Guest cookies do not grant management access.', 'Browser-session cookies or a technical lifetime of up to seven days. The separate server-side 24h/30-minute defaults impose shorter access.'],
      ['demeters-language (localStorage)', 'Requested HU/EN language preference; functional storage.', 'Until browser data is cleared or the preference is replaced.'],
      ['demeters-booking-intent (sessionStorage)', 'Recognising the same booking intent after a network retry.', 'Until a successful booking, replacement of the entry or the end of the browser’s session storage.']
    ] } },
    { id: 'kovetes', title: '10. Bot checks, analytics and marketing', paragraphs: [
      'An embedded Google Map displays the address. Loading it connects your browser to Google and may transmit IP and technical request information; see the Google privacy notice.',
      'When enabled, Turnstile loads when you initiate a code request or password login. The application’s own device list does not store full browser identifiers or hardware fingerprints. Cloudflare may nevertheless process technical browser/network signals for its bot checks. See the Cloudflare Turnstile Privacy Addendum.',
      'The current application code does not install Google Analytics, Meta Pixel or another marketing tracker. Its internal analytics-event helper is off by default and has no network transport on its own. Introducing measurement or advertising tools requires prior information and consent where applicable. The operator must also check tracking/analytics options enabled separately in hosting and email dashboards before publication.'
    ] },
    { id: 'jogok', title: '11. Your rights', paragraphs: [
      'You may request information, access and correction, and erasure or restriction where the conditions apply. Portability may apply to automated processing based on contract or consent. You may object to legitimate-interest processing on grounds relating to your situation.',
      'Consent may be withdrawn at any time without affecting earlier lawful processing. Revoke a remembered device or log out to end remembered access. Cancelling an appointment is different from erasing a profile. Any continuing retention after an erasure request needs its own valid basis.'
    ] },
    { id: 'kerelem', title: '12. Making a privacy request', paragraphs: [
      'Write to the relevant barber’s privacy contact in section 1, identifying your request, booking email and, if possible, the barber or appointment. The platform operator should route requests it receives to the competent controller and assist within its processing role. Tell us if your request concerns the entire shared profile; requests affecting several independent controllers require coordination. Do not send passwords, verification codes or full identity-document copies. We may ask only for proportionate additional information needed to verify identity.',
      'The normal response period is one month. Complex or numerous requests may require up to two additional months; reasons and notice of an extension must be given within the first month. Requests are normally free; refusal or an exceptional fee requires the applicable legal conditions and an explanation. Where necessary, recipients must also be informed of correction or erasure.'
    ] },
    { id: 'dontes', title: '13. Automated checks and security', paragraphs: [
      'The system checks clashes, working hours, booking quotas and excessive requests; bot checks can also reject an attempt. These are technical protections, not advertising or creditworthiness profiling. Ask the salon for human review if a restriction appears incorrect. We do not intend to make solely automated decisions with legal or similarly significant effects under GDPR Article 22.',
      'Access is protected by code verification, separated permissions, secure sessions and additional management-account controls. A personal-data breach requires the controller to assess risks and applicable notification duties. Technical safeguards do not guarantee complete immunity from incidents.'
    ] },
    { id: 'kepek', title: '14. Public barber profiles and portfolios', paragraphs: [
      'A public profile may show the barber’s name, introduction, intended public professional information and photographs. Publishing an identifiable guest image requires a separate appropriate legal basis and respect for image/personality rights. Booking or reading this notice is not consent to publish a photograph. Agree specific publication arrangements separately with the salon.'
    ] },
    { id: 'panasz', title: '15. Complaints and remedies', paragraphs: [
      'You may contact the controller, complain to the Hungarian National Authority for Data Protection and Freedom of Information (NAIH), or seek a judicial remedy. NAIH: 1055 Budapest, Falk Miksa utca 9–11.; postal address: 1363 Budapest, Pf. 9.; telephone: +36 (1) 391 1400.',
      'The NAIH contact page explains official filing channels. ugyfelszolgalat@naih.hu is an enquiry contact; according to the authority, ordinary email does not initiate a formal procedure. You do not have to contact the salon first before seeking a remedy.'
    ], links: [['NAIH – contact and filing information', 'https://www.naih.hu/ugyfelszolgalat-kapcsolat']] },
    { id: 'valtozas', title: '16. Updates and references', paragraphs: [
      'Changes will identify a version and effective date. New purposes or material changes require information before processing begins. Updating a notice does not create a new legal basis or replace any required consent.'
    ], links: PRIVACY_SOURCES }
  ],
};
export const PRIVACY_COPY = { hu, en };
