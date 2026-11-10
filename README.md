# Presztízs Barber — főoldal (editorial)

Next.js **Pages Router** projekt. A meglévő hero videót, a fehér szolgáltatáskártyákat és a 3D-s barbergalériát változatlanul hagytuk, ezek után az alábbi három szekció került:

- `SalonStory.jsx` / `styles/SalonStory.module.css`: aszimmetrikus szalonbemutató, moody fotóval és videóból vett részlettel.
- `TrustSection.jsx` / `styles/TrustSection.module.css`: konverzió előtti bizalomépítő rész. **Nincsenek kitalált vendégvélemények**. Helyettük jelenleg három vállalt érték látható. A komponens elején lévő `REVIEWS` tömbbe később valódi, jóváhagyott értékelések írhatók; ekkor automatikusan értékeléseket jelenít meg.
- `BookingFooter.jsx` / `styles/BookingFooter.module.css`: erős foglalási CTA és lábléc.

A fejléc hibás `#munka` és `#rolunk` hivatkozásait létező szekciókhoz igazítottuk.

## Futtatás

```bash
npm install
npm run dev
```

## Kiélesítés előtt kötelező

1. **A valós szalonfotót** add hozzá, és módosítsd a `SALON_IMAGE` értéket a `components/SalonStory.jsx` fájlban. Jelenleg Unsplash hangulatkép van megadva, hálózati hiba esetén helyi, korábbi prototípus-kép a fallback. A fotó mellett külön, diszkrét figyelmeztetés szerepel a demón.
2. **Valódi vendégvélemények** csak engedéllyel/nyilvános forrás alapján kerüljenek be a `TrustSection` `REVIEWS` tömbjébe. Addig az értékek szekció jelenik meg.
3. **Valós foglalórendszer** még nincs. Az új `pages/idopontfoglalas.jsx` csak egy jól kinéző, `noindex` demóoldal, amely őszintén jelzi, hogy a foglalás nem aktív. Ezt a meglévő külső foglalóval vagy a készülő belső foglalással kell összekötni.
4. **Szolgáltatások, árak, barbernevek, portrék** az eredeti, feltöltött projektben is mintaadatok voltak. Ezeket ellenőrizni kell a publikálás előtt.
5. **Cím, nyitvatartás és elérhetőségek** nem szerepeltek a mellékelt forrásban, ezért nem kerültek kitalálásra a láblécben.

## Fájlstruktúra

A projekt `components`, `styles`, `pages`, `public` mappái megmaradtak. Nincs `src/` könyvtár, a CSS fájlok továbbra is a `styles/` mappában vannak.
