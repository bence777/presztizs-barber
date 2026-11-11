# Presztízs Barber – foglaláskezelő e-mail-linkek javítása

Ez a frissítés a legutóbbi **admin dashboardos** projektverzióra épül.

## Javítások

- Az új foglalásról a **vendég** a `/foglalasaim?booking=<foglalás-id>`, a **barber/szalon** a `/admin/foglalasok?booking=<foglalás-id>` címre kap gombot és szöveges linket.
- Foglalás módosítása vagy állapotváltása után is szerepel a megfelelő kezelőlink mindkét e-mailben.
- Végleges törléskor a két foglaláslista nyílik meg (mert a törölt foglalás már nem létezik).
- Lokális fejlesztéskor hiányzó `SITE_URL` esetén alapértelmezett `http://localhost:3000` linket használ, illetve a `PORT` értékét, ha van.
- Éles környezetben érvényes HTTPS alapcím kell. Nem küld többé link nélküli értesítést: szerveroldali hibát naplóz és `emailSent` hamis értékeket ad vissza.
- Adminfelületen **új foglalásnál alapból bekapcsolva** az e-mail értesítés. Meglévő foglalás szerkesztésekor a tesztadatoknál kikapcsolva, valódi foglalásoknál bekapcsolva. A kapcsoló szabadon módosítható.
- A barber címe a `booking_staff.email` mezőből kerül kiolvasásra; cím hiányában a korábban beállított szalonértesítési cím az alapértelmezett.

## Telepítés

1. Csomagold ki a `presztizs-email-linkek-javitas.zip` tartalmát a mostani Next.js projekt gyökerébe, az azonos fájlok felülírásával.
2. A `.env.local` fájlban élesítés előtt add meg a helyes alapcímet:
   `SITE_URL=https://sajat-eles-domain.hu`
   Lokálisan: `SITE_URL=http://localhost:3000` vagy `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
3. Ellenőrizd a Resendhez szükséges `RESEND_API_KEY` és `RESEND_FROM` szerveroldali környezeti változókat. A titkos kulcsot ne másold a böngészős kódba.
4. Indítsd újra: `npm run dev`.
5. Készíts egy új tesztfoglalást, és ellenőrizd mindkét e-mailt. A korábban elküldött levelek nem módosulnak.

**Fontos:** `localhost` linket az e-mail címzettje csak a saját gépén futó fejlesztői szerverhez használhat. Másik eszközről történő teszthez éles vagy más módon elérhető HTTPS webcímre van szükség.

A felhasználó továbbra is e-mailes OTP-vel azonosítja magát, a barber pedig szerveroldalon ellenőrzött kezelői jogosultsággal lép be. A link önmagában nem ad jogosultságot.

## Teszt

`node --experimental-default-type=module --test tests/*.test.mjs`

20 teszt sikeresen futott a kód javítása után, köztük az új e-mail HTML és plain-text linktesztek. Valós Resend küldést / teljes Next.js buildet ebben a környezetben nem futtattunk.
