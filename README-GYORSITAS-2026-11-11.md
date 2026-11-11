# Foglaló gyorsítás és barber 2/3 – 2026-11-11

## Éles Supabase-adatbázis

A `presztizs-barber` projekt ellenőrzésekor `barber-2` és `barber-3` aktív volt, de mindkettőhöz nulla `booking_hours` sor tartozott. Tesztbarbereknek az első barber hétköznapi 09:00–17:00 rendjének másolata került be (5-5 bejegyzés), kizárólag akkor, ha korábban nem volt munkaidejük. Ezek **ideiglenes tesztbeállítások**, a valódi munkarenddel cserélendők, mielőtt ügyfeleknek nyilvánosan foglalhatóvá teszed őket.

## Teljesítményváltoztatások

- A Vercel futtatási régió Frankfurt (`fra1`), közelebb a Supabase Frankfurt (`eu-central-1`) régióhoz. Ez hálózati késleltetést csökkenthet.
- Szolgáltatások és aktív barberek szerveroldali, rövid (45 másodperces) cache + azonosidejű kérések összevonása.
- A munkaidő szerveroldali cache-e 30 másodperc; mentéskor minden törzsadat és munkaidő frissen ellenőrzött.
- A foglalások/távollétek lekérdezése csak a kiválasztott barber(ek)re és az adott hónapra szűrve történik.
- A naptár számítása előre csoportosítja a beosztásokat és blokkolt intervallumokat, ahelyett hogy minden potenciális idősávhoz újra szűrne.
- A publikus konfiguráció Vercel edge-cache-je 45 mp; anonim elérhetőség 8 mp. Az API `Cache-Control: no-store` böngészőoldali szabályát nem írjuk felül; a `Vercel-CDN-Cache-Control` csak a Vercel köztes rétegére vonatkozik.
- Rövid memóriacache a foglaló React oldalán; a következő hónap előtöltése. Nem tárolunk személyes adatot.
- Sikertelen ütközés (409) esetén az érintett cache törlése és cache-bypass újratöltés.
- A backend POST mentés **minden esetben friss** törzsadatot, beosztást, foglalásokat és távolléteket kér le, és a DB kizáró constraint továbbra is védi az ütközéseket.
- Ha nincs beosztás, a naptár jelzi, hogy a barberhez munkaidő szükséges.

## Telepítés

A projektet pushold a fő GitHub branchre; a `vercel.json` már benne van. Vercel-ben ellenőrizd, hogy nincs-e az új régióbeállítást felülíró konfiguráció. A Supabase-ben a barber-2/3 mintaórák már rögzítve vannak, SQL-futtatás nem szükséges. Megváltoztatott beosztások legfeljebb rövid ideig jelenhetnek meg cache-ből; a végleges foglalás mindig a friss beosztást ellenőrzi.
