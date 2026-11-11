# Presztízs Barber — visszaigazolás és foglaláskezelés

A 2026-11-11-i, felhasználó által elküldött projekten alapuló frissítés.

## Mit tartalmaz?

- Vendég: `/foglalasaim` — ugyanaz a Supabase Auth / 6–10 számjegyes e-mailes OTP mint a foglalásnál. Közelgő, múltbeli és lemondott foglalások; lemondás és új foglalás.
- Szalon: `/admin/foglalasok` — ugyanazzal az OTP-azonosítással, de **külön, szerveroldalon lekért `booking_managers` engedéllyel**. Tulajdonos minden foglalást lát; egy későbbi `barber` szerepkör kizárólag a saját fodrászhoz tartozókat. Kezelői lemondás, teljesített, nem jelent meg állapot.
- Két Resend tranzakciós e-mail új foglalásra, továbbá állapotváltozáskor mindkét félnek: a vendégnek `/foglalasaim?booking=<id>`, a barbernek/szalonnak `/admin/foglalasok?booking=<id>` mélyhivatkozás. A megadott foglalás akkor is megjelenik, ha régebbi a lista első oldalánál.
- A szalon értesítése először a `booking_staff.email`-re megy, ha az az adott barberhez be van állítva; különben **bencebalogh7777@gmail.com**-ra. A próbához ez a cím `owner` kezelői engedélyt kapott.

## Már elvégzett éles Supabase módosítások

- `booking_staff.email` nullable mező
- `booking_appointments.guest_email` nullable mező, és új állapotok: `completed`, `no_show`
- `booking_managers` tábla RLS-sel, a jogosultsági ellenőrzés kizárólag szerverről, secret key használatával történik.
- `bencebalogh7777@gmail.com` kezelő (owner). A név nélküli teszt-barberek maradtak.

**Nincs új SQL, amit a mellékelt projekt használatához futtatni kell.**

## `.env.local` szükséges beállításai

```env
SUPABASE_URL=https://fdvhdpguhqjmoojarurz.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SESSION_SIGNING_SECRET=...legalább-32-karakter...
RESEND_API_KEY=re_...
RESEND_FROM="Presztízs Barber <foglalas@bybence.co>"
NEXT_PUBLIC_SITE_URL=https://a-valodi-eles-domain.hu
```

A `RESEND_FROM` hitelesített Resend domainről küldjön. A Supabase OTP-hez beállított SMTP-t ez nem helyettesíti. A `RESEND_API_KEY` a Next.js API kódjában szerveroldalon kell az **új foglalási levelekhez**, nem csak a Supabase SMTP konfigurációjában.

`NEXT_PUBLIC_SITE_URL` legyen a tényleges HTTPS domain éles környezetben. Ha **még nincs meg a domain**, lokálisan állítható `http://localhost:3000`-ra, a kapott e-mail hivatkozás ilyenkor csak az adott gépen működik.

Élő próba előtt azokat a Resend API-kulcsokat cseréld le, amelyek korábban véletlenül üzenetben szerepeltek. A kulcsokat ne add át másnak és ne committold a repóba.

## Hogyan próbáld ki?

1. Másold be az új fájlokat és írd felül a módosítottakat, majd indítsd újra a Next.js szervert.
2. Foglalj egy tesztidőpontot saját vendégfiókkal. Foglalás elmentésekor két Resend értesítés indul párhuzamosan. A backend sikertelenség esetén is megtartja a rögzített foglalást, és naplózza a sikertelen e-mailküldést.
3. Nyisd meg `/foglalasaim`: lépj be vagy hagyd jóvá a megjegyzett profilodat; ellenőrizd a foglalást és a lemondás funkciót.
4. Nyisd meg `/admin/foglalasok`: jelentkezz be **bencebalogh7777@gmail.com**-mal (másik fiók után előbb lépj ki). Az adminjog e-mail alapján, szerveroldalon ellenőrzött; az oldal megnyitása önmagában nem ad adminjogot.
5. Próbáld ki az adminlemondást vagy a lezárt időpont státuszának módosítását.

## Későbbi barber e-mail és jogosultság

Amint megvannak a valós barbernevek és e-mail-címek, a `booking_staff` tábla adott `id` sorának `email` mezőjét állítsd be. Például:

```sql
update public.booking_staff set email='barber@example.com' where id='barber-1';
insert into public.booking_managers (email,role,staff_id,active)
values ('barber@example.com','barber','barber-1',true)
on conflict (email) do update set role=excluded.role,staff_id=excluded.staff_id,active=true;
```

A példacím helyett a valós barber e-mailjét használd. Ettől az új foglalás értesítése automatikusan neki megy, és a hozzá tartozó foglalásokat láthatja a `/admin/foglalasok` oldalon. A szalontulajdonos továbbra is mindet látja.

## Jelenlegi korlátok

- Ez a verzió **lemondást** és lezárást támogat, de még nem tesz át foglalást másik időpontra (új foglalás + régi lemondása szükséges).
- A foglalási e-mailek az új időpont rögzítéséhez kötöttek. A már korábban meglévő foglalásokhoz visszamenőleg nem küld levelet.
- A tranzakciós e-mail kézbesítése függ a Resend hitelesítésétől és a feladó domainjétől; az SMTP-beállítás önmagában nem elegendő.
- Az e-mailes beléptető kód és a kezelői jog nem felcserélhető: minden kezelőnek saját, engedélyezett emaillel kell belépnie.
- Külön SMTP/Resend konfiguráció vagy a konkrét domain nélkül a levelezést nem lehetett végponttól végpontig kipróbálni.

## Ha az e-mailben még a régi szöveg szerepel
A korábbi `bookingEmail.js` sablonban az állt, hogy a vendég vegye fel a kapcsolatot a szalonnal. Ez **a régi verzió**, nem a foglaláskezelő frissítése. Másold felül a `lib/server/bookingEmail.js` fájlt, állítsd be a `NEXT_PUBLIC_SITE_URL` értékét (lokálisan `http://localhost:3000`), indítsd újra a Next.js szervert, majd készíts **új tesztfoglalást**. A már elküldött e-mail nem változik meg.

## Vercel-szerű adminnaptár (2026-11-11)

A `/admin/foglalasok` most önálló foglaláskezelő dashboard:

- Nap, hét és hónap nézet, kattintható naptáresemények, időpont-felvétel üres sávra kattintva.
- Listanézet és keresés / barber- és státuszszűrő.
- A jobboldali panelen létrehozás, szerkesztés, állapotváltás és végleges törlés.
- Ütközést az adatbázis zárja ki (nem lehet ugyanaz a barber egyszerre két aktív foglaláson).
- Az admin által felvett vendégek név/e-mail/telefon adatai közvetlenül a foglalásban tárolódnak. Az e-mail opcionális, de e-mail nélkül értesítés nem küldhető a vendégnek.
- Az e-mailes értesítés külön bejelölhető (alapból kikapcsolt, hogy teszteléskor ne küldjünk véletlenül leveleket).
- A `DELETE` valóban végleg törli a foglalást. Ha csak lemondás kell, állítsd az állapotot `Lemondva` értékre: így megmarad az előzmény.
- Az `is_demo`-val jelölt tesztfoglalások nem változtak meg; a jelölés szerkesztéskor megmarad.
- A meglévő mini-profilos vendégek a saját foglalásaikat továbbra is kezelhetik. Új, manuális vendégfoglalás az e-mailes azonosítása után automatikusan a fiókjához kapcsolódik a `/foglalasaim` oldalon.
- Külön barber-fiókkal belépve a szerveroldali API-k kizárólag a hozzárendelt barber foglalásait engedik módosítani.

**Szükséges adatbázisséma:** `supabase/sql/admin_dashboard_manual_bookings.sql`. A kapcsolt Presztízs Barber projektben már végrehajtottam; nem kell újra futtatni.

**Telepítés:** a frissítés ZIP tartalmát másold a Next.js projektedbe úgy, hogy az azonos fájlokat felülírod. Ezt követően: `npm run dev`, majd `http://localhost:3000/admin/foglalasok`. A bejelentkezés változatlan, a meglévő Supabase/Resend környezeti változókat használd.
