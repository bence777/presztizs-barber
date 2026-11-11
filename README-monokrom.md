# Presztízs Barber — monokróm frissítés

Az új szekciók színvilága a hero fekete–fehér arculatához igazodik. Nincs bézses/krémes alapszín és nincs mélyzöld CTA.

## Változások

- `TrustSection`: átépítve fehér, aszimmetrikus editorial layouttá. A korábbi három nagyméretű egymás melletti értékblokk helyett a jobb oldalon kompakt, számozott sorok vannak. Valódi vélemények hozzáadása később is működik, a kitalált vélemények továbbra is tiltva.
- `BookingFooter`: fekete, balra rendezett, nagy serif headline, diszkrét fekete-fehér háttérfotó, egy fehér CTA és monokróm lábléc.
- `Services`, `SalonStory`, `Home`: csak a korábban bennragadt zöldes/krémes színeket semlegesítettük, az elrendezés és a hero változatlan.

## Telepítés

A patch ZIP tartalmát másold a projekt gyökérkönyvtárába, a fájlokat felülírva. A `styles` mappa marad a `styles`, nincs `src` mappa. Utána `npm run dev`.

A foglalás továbbra is demóoldal. A szalonfotók és a szolgáltatásadatok helykitöltők, publikálás előtt ellenőrizendők.
