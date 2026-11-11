# Időpontfoglaló – helyes lépésjelző és árösszegzés

A korábbi két sorból a **felső, fekete foglalás-összefoglaló négy adatsorát** (01 / SZOLGÁLTATÁS, 02 / BARBER, 03 / IDŐPONT, 04 / ADATAID) távolítottuk el.

- **Megmaradt:** az alsó, fehér `FOGLALÁSI FOLYAMAT` fejléc és négyállomásos, kattintható lépésjelző.
- **Megmaradt:** a fekete területen a várható összeg, egy kompakt sávban.
- **Mobilon:** ugyanaz a fehér lépésjelző jelenik meg kisebb, négyoszlopos elrendezésben, nem egy második fekete navigáció.
- A szolgáltatás-, barber-, időpont- és adatkiválasztó felületek, API-k, gyorsítótárazás és adatbázis változatlan maradt.

Érintett fájlok: `components/BookingWizard.jsx`, `styles/BookingWizard.module.css`, `tests/booking-ui-steps.test.mjs`.
