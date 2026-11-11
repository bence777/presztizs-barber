# Presztízs Barber – éles foglalási backend

## Mi készült el?

- A Next.js foglaló a Supabase-ben aktívként megjelölt szolgáltatásokat/barbereket tölti be; a főoldali, fehér árkártyák ugyanebből a forrásból kapják az árakat.
- A havi naptár **valódi** szabad időpontokat számít az adott barber munkaórái, szabadsága és a már foglalt időszakok alapján (Budapest időzóna).
- Kezdési időpontok: 30 percenként; minimum 2 órás előfoglalási idő; maximum 60 nap előre.
- Az azonosított vendég a „VÉGLEGESÍTÉS” gombbal egy valós `booking_appointments` rekordot hoz létre; nem elegendő az e-mail-címet szabadon beírni, Supabase Auth munkamenet kell.
- `booking_no_staff_overlap` és `booking_no_guest_overlap` PostgreSQL GiST EXCLUDE constraint megakadályozza az átfedő aktív foglalásokat, párhuzamos kéréseknél is.
- Ha két kliens egyszerre választja ugyanazt, a második 409-es választ kap, és újra lekérheti a naptárat. „Bárki” esetben a szerver másik elérhető barberrel próbálkozik.
- Resend HTTP API-val opcionális **foglalási visszaigazoló e-mail**. Ennek hibája nem törli a már létrejött foglalást. A Supabase SMTP továbbra is az Auth OTP-kódokat küldi.

## 1. ENV

A meglévő `.env.local` Supabase Auth változóit megtartod, és hozzáadsz egyetlen kötelező új változót:

```env
SUPABASE_URL=https://<projekt-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SESSION_SIGNING_SECRET=<legalább-32-karakter>
SUPABASE_SECRET_KEY=sb_secret_...

# Opcionális: foglalási visszaigazolások (NEM Auth OTP):
RESEND_API_KEY=re_...
RESEND_FROM="Presztízs Barber <foglalas@hitelesitett-domain.hu>"
```

`SUPABASE_SECRET_KEY` a Supabase Dashboard **Project Settings → API Keys → Secret keys** részből jön. Kizárólag a Next.js API route-jaiban használjuk. SOHA ne használd `NEXT_PUBLIC_` előtaggal és ne commitold Gitbe. Ha kikerül, azonnal forgasd.

Az SMTP-s Supabase belépéshez **nem** kell `SEND_EMAIL_HOOK_SECRET` és nem kell Edge Function.

## 2. Adatbázis

A hozzád kapcsolt **presztizs-barber** Supabase-projektben a `presztizs_real_booking_core` migrációt már alkalmaztam, a `btree_gist` bővítményt pedig külön áthelyeztem az `extensions` sémába. Ne futtasd újra.

A teljes adatmodell a `supabase/sql/real_booking.sql` fájlban szerepel, másik projektre történő telepítéshez. Az `setup_example.sql` fájl kiinduló mintákat ad a végleges adatok beállításához.

**A táblák szándékosan üresek.** Nem aktiváltam kitalált neveket, árakat vagy munkaidőt, mert ezekből tényleges ügyfélfoglalás születne.

Kötelezően feltöltendő: `booking_services`, `booking_staff`, `booking_hours`. Opcionális, de érdemes vezetni: `booking_time_off` (szabadságok, szünetek, ünnepnapok).

### Munkarend példa

| weekday | Nap |
|---|---|
| 0 | Vasárnap |
| 1 | Hétfő |
| 2 | Kedd |
| 3 | Szerda |
| 4 | Csütörtök |
| 5 | Péntek |
| 6 | Szombat |

Az `opens`/`closes` a valós foglalható munkaidő, helyi Budapest-idő szerint. Ebédszünet esetén két sort vigyél fel (pl. 9–12, 13–18).

Egy barberhez csak a saját munkaórái alapján jönnek létre idősávok. Vasárnap is foglalható, ha az adott barberhez van aktív vasárnapi munkarend.

## 3. Tesztelés

```bash
npm run dev
# localhost:3000/idopontfoglalas
```

Először állíts be valódi adatokat és legalább egy barber munkaidejét. Az e-mailes azonosítás után foglalj egy tesztidőpontot: a `booking_appointments` táblában `confirmed` állapotú rekordnak kell létrejönnie. Frissítés után ugyanaz az idősáv már nem fog megjelenni annál a barbernél. Egy másik böngészőben sem lesz foglalható.

```bash
node --experimental-default-type=module --test tests/booking.test.mjs
```

Ez 3 automatizált tesztet futtat mock DB-vel; a tesztek **nem írnak** az éles adatbázisba.

## API-k

- `GET /api/booking/config` – aktív szolgáltatások és barberek, személyes adatok nélkül
- `GET /api/booking/availability?service=...&barber=...&month=YYYY-MM` – valóban elérhető napok, kezdési idők
- `POST /api/booking/create` – érvényes OTP-vel hitelesített, profilját már mentő vendég foglalása

## Élesítés előtti szükséges kiegészítések

- Tényleges szalonadatok (nevek, árak, munkarend, szünet, szabadság) rögzítése és ellenőrzése.
- Adatkezelési tájékoztató, adatmegőrzési szabályok, kapcsolat/lemondás módja és az értesítési tartalom véglegesítése.
- Vendég általi lemondás/módosítás és adminnaptár még nincs; a státusz mező támogatja a későbbi lemondást, amely felszabadítja az időpontot.
- Az opcionális foglalási visszaigazolást új, nem kiszivárgott Resend kulccsal érdemes aktiválni. A vendég UI akkor is „sikeres foglalás”-t mutat, ha az opcionális e-mail küldése hibás.
- A szerveroldali API-végpontokat éles forgalom előtt IP-/vendégoldali rate limit védelemmel és botvédelemmel lássuk el; a Supabase Auth saját korlátjai ettől függetlenek.

Minden CSS az eddigi `styles/` mappában marad, és a hero, árak, barbergaléria változatlan.
