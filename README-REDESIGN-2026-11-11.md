# Presztízs Barber — foglaló redesign (2026-11-11)

A meglévő Next.js Pages Router projekt teljes foglalási frontendje átdolgozva a jóváhagyott fekete–fehér, editorial látványterv alapján. Az eredeti Supabase/Resend integráció, API route-ok, adminfelület, jogosultságok, foglalási logika, eszközkezelés és adatvédelmi kontrollok megmaradtak.

## A fő változások
- Teljes szélességű sötét, szalonfotós hero; letisztult fejléc, asztali navigáció és mobil hamburger menü.
- Sötét asztali összegző sáv négy lépéssel, folyamatosan frissülő árral.
- Mobilon csak egyetlen, rövid négyállomásos lépésjelző és egy kompakt összeg-kártya. Nincs egymás alá halmozott, ismétlődő összegző és lépéslista.
- Világos foglalófelület, számozott asztali lépésjelző, lekerekített szolgáltatáskártyák, letisztult barber-választó, naptár és megerősítő gombok.
- A gombokon és linkeken megjelenített nyíl ikonok/szimbólumok eltávolítva az admin és vendégfelületeken is; a naptárléptetők feliratosak.
- Mobileszközön 320 px szélességig külön breakpointok, nagyobb érintési területek.

## Futtatás
```bash
npm ci
npm run dev
```
Nyisd meg: http://localhost:3000/idopontfoglalas

Az API-k használatához az eredeti README-kben felsorolt környezeti változókat és Supabase beállításokat kell használni. Éles adatok nélkül a szolgáltatások/online foglalások nem feltétlenül töltődnek be.

## Érintett fájlok
- `pages/idopontfoglalas.jsx`
- `components/BookingWizard.jsx`
- `styles/BookingPage.module.css`
- `styles/BookingWizard.module.css`
- `components/TrustedDevices.jsx`, `BookingManageList.jsx`, `BarberStack.jsx`, `AdminIdentityGate.jsx`, `AdminDashboard.jsx`
- `styles/AdminDashboard.module.css`

A 30 meglévő, Node beépített tesztfuttatóval végzett automatizált teszt sikeres (`node --test tests/*.test.mjs`). A függőségek online telepítése ebben a munkakörnyezetben nem fejeződött be, ezért a teljes Next.js fordítást és a böngészős vizuális ellenőrzést helyben még le kell futtatni.
