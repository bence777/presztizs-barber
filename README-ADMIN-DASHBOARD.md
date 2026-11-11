# Presztízs Barber – Admin Dashboard

**Cím:** `/admin/foglalasok`

Új, minimál, Vercel-ihlette (fekete oldalsáv, fehér dashboard) kezelőfelület:

- Nap / hét / hónap naptár, mini eseménykártyák, kattintható szabad idősávok
- Külön foglalási listanézet, vendég/service/barber/állapot szerinti keresés és szűrés
- Új foglalás hozzáadása a naptárból vagy az „Új foglalás” gombbal
- Foglalás adatainak szerkesztése: dátum, idő, barber, szolgáltatás, vendég név, e-mail, telefon, állapot
- Végleges törlés (külön megerősítéssel); egyszerű lemondáshoz állítsd a foglalás állapotát „Lemondva” értékre
- Külön kapcsoló a Resend e-mailes értesítéshez; tesztelésnél alapból **KI** van kapcsolva
- Barber szerepkör esetén csak az adott barber foglalásai láthatók és kezelhetők
- A foglalások ütközését továbbra is a Supabase adatbázisában levő kizáró constraint akadályozza meg
- Manuális foglaláshoz nem kell előzetes regisztráció: a vendég nevét, telefonszámát és e-mailjét közvetlenül rögzítheted. A vendég később az e-mailes belépése után a foglalást a saját mini profiljában is látja.

## Telepítés

**A `-csak-frissitesek.zip` csomagot** csomagold ki a mostani projekted gyökerébe, felülírva az azonos fájlokat. A többi fájlodat nem érinti.

```bash
npm run dev
```

Majd: `http://localhost:3000/admin/foglalasok`

**Fontos:** a szerveren maradjanak beállítva a korábban működő `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SIGNING_SECRET` változók. A RESEND_API_KEY/RESEND_FROM csak az értesítés küldéséhez kell.

Az új SQL változtatásokat már beállítottam a csatlakoztatott `presztizs-barber` Supabase-projektben. **Nem kell újra lefuttatni** a `supabase/sql/admin_dashboard_manual_bookings.sql`-t. Az SQL fájlt csupán a későbbi telepítésekhez mellékeltem.

## Adatok és működés

A 31 meglévő foglalást változatlanul hagytam. Az új foglalásokat a felületről lehet rögzíteni; véletlenül nem küldünk e-mailt, mert az értesítési jelölőnégyzet alapból nincs bejelölve.

Ha a kívánt időpont ütközik, a szerver `409` választ ad: válassz másik idősávot/barbert. A naptárban a kézzel felvett, munkarenden kívüli időpontok is menthetők, mert az admin tudatosan felülírhatja a nyitvatartást; az ütközésvédelmet **nem** írhatja felül.

**Vendég e-mail nélkül:** a kézi foglalás létrejöhet, de visszaigazoló e-mail nyilván nem küldhető. E-maillel megadott, még nem regisztrált vendég esetén a foglalás a vendég későbbi e-mail-azonosítása után kapcsolódik a mini profilhoz.

## Ellenőrzés

- 14 Node teszt sikeres (meglévő OTP/foglalási tesztek + 6 új CRUD teszt).
- A JSX/JS források szintaktikai vizsgálata rendben.
- Az új adatbázismezők és a meglévő átfedésvédelmi szabályok megléte ellenőrizve.
- Teljes Next.js buildet nem lehetett lefuttatni ebben a környezetben: a telepített `node_modules/next` üres, ezért a `next` parancs nem található.
