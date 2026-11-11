import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { formatPrice } from "../data/bookingConfig";
import { getCachedAvailability, invalidateCachedAvailability, loadPublicAvailability, loadPublicCatalog } from "../lib/client/bookingCache.mjs";
import GuestIdentity from "./GuestIdentity";
import styles from "../styles/BookingWizard.module.css";

const TIMEZONE = "Europe/Budapest";
const STEPS = ["Szolgáltatás", "Barber", "Időpont", "Adataid"];
const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const MONTHS = [
  "január", "február", "március", "április", "május", "június",
  "július", "augusztus", "szeptember", "október", "november", "december",
];

function getTodayInDebrecen() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function parseUtc(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(iso, days) {
  const date = parseUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

function monthIndex(iso) {
  const [year, month] = iso.split("-").map(Number);
  return year * 12 + month - 1;
}

function monthParts(index) {
  return { year: Math.floor(index / 12), month: index % 12 };
}

function formatDay(iso) {
  if (!iso) return "Még nincs kiválasztva";
  return new Intl.DateTimeFormat("hu-HU", {
    timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(parseUtc(iso));
}

function createCalendar(index) {
  const { year, month } = monthParts(index);
  const firstDay = new Date(Date.UTC(year, month, 1, 12));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => toKey(new Date(Date.UTC(year, month, i + 1, 12)))),
  ];
}

export default function BookingWizard() {
  const router = useRouter();
  const workspaceRef = useRef(null);
  const previousStepRef = useRef(0);
  const [today, setToday] = useState(getTodayInDebrecen);
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(null);
  const [barberId, setBarberId] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(() => monthIndex(getTodayInDebrecen().date));
  const [person, setPerson] = useState({ name: "", email: "", phone: "" });
  const [showPreview, setShowPreview] = useState(false);
  const [verified, setVerified] = useState(false);
  const [catalog, setCatalog] = useState({ services: [], barbers: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [availableDays, setAvailableDays] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [hasWorkingHours, setHasWorkingHours] = useState(null);
  const lastRefreshRef = useRef(0);
  const [availabilityError, setAvailabilityError] = useState("");
  const [refreshAvailability, setRefreshAvailability] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const SERVICES = catalog.services;
  const BARBERS = catalog.barbers;

  useEffect(() => {
    let active = true;
    loadPublicCatalog()
      .then(data => { if (active) setCatalog({ services: data.services || [], barbers: data.barbers || [] }); })
      .catch(error => { if (active) setCatalogError(error.message); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!serviceId || !barberId) return;
    let active = true;
    const month = `${monthParts(visibleMonth).year}-${String(monthParts(visibleMonth).month + 1).padStart(2, "0")}`;
    const force = refreshAvailability !== lastRefreshRef.current;
    lastRefreshRef.current = refreshAvailability;
    const cached = !force && getCachedAvailability(serviceId, barberId, month);
    setAvailabilityError("");
    setDate(null);
    setTime(null);
    if (cached) {
      setAvailableDays(cached.days || {});
      setHasWorkingHours(cached.hasWorkingHours !== false);
      setAvailabilityLoading(false);
    } else {
      setAvailableDays({});
      setHasWorkingHours(null);
      setAvailabilityLoading(true);
    }
    loadPublicAvailability(serviceId, barberId, month, { force })
      .then(data => {
        if (!active) return;
        setAvailableDays(data.days || {});
        setHasWorkingHours(data.hasWorkingHours !== false);
        // A következő hónapot alacsony prioritással előtöltjük.
        // Így a naptárlapozás rendszerint azonnali lesz.
        const nextIndex = visibleMonth + 1;
        const now = getTodayInDebrecen();
        if (nextIndex <= monthIndex(addDays(now.date, 60))) {
          const next = monthParts(nextIndex);
          const nextMonth = `${next.year}-${String(next.month + 1).padStart(2, "0")}`;
          loadPublicAvailability(serviceId, barberId, nextMonth).catch(() => {});
        }
      })
      .catch(error => { if (active) setAvailabilityError(error.message); })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [serviceId, barberId, visibleMonth, refreshAvailability]);

  // A szolgáltatás vagy barber előre kiválasztható a főoldalról:
  // /idopontfoglalas?service=skin-fade&barber=mark
  useEffect(() => {
    if (!router.isReady) return;
    const service = SERVICES.find((item) => item.id === router.query.service);
    const barber = BARBERS.find((item) => item.id === router.query.barber);
    if (service) setServiceId(service.id);
    if (barber) setBarberId(barber.id);
    if (service && barber) setStep(2);
    else if (service) setStep(1);
  }, [router.isReady, router.query.service, router.query.barber, catalog]);

  // A felület állapotát Debrecen szerinti dátumhoz igazítjuk.
  useEffect(() => {
    const fresh = getTodayInDebrecen();
    setToday(fresh);
    setVisibleMonth((month) => Math.max(month, monthIndex(fresh.date)));
  }, []);

  // Mobilon lépésváltáskor a következő panel elejére görgetünk,
  // de az oldal első betöltésekor nem ugrunk le a címsorról.
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    if (window.innerWidth <= 800) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      workspaceRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }, [step]);

  const service = SERVICES.find((item) => item.id === serviceId) || null;
  const barber = BARBERS.find((item) => item.id === barberId) || null;
  const maxDate = addDays(today.date, 60);
  const calendar = useMemo(() => createCalendar(visibleMonth), [visibleMonth]);
  const slots = date ? (availableDays[date] || []) : [];
  const canReview = verified && person.name.trim().length >= 2 && /.+@.+\..+/.test(person.email.trim()) && person.phone.replace(/\D/g, "").length >= 7;
  const canOpen = (index) => index === 0 || (index === 1 && Boolean(serviceId)) ||
    (index === 2 && Boolean(serviceId && barberId)) ||
    (index === 3 && Boolean(serviceId && barberId && date && time));

  function selectService(id) {
    setServiceId(id);
    setDate(null);
    setTime(null);
    setShowPreview(false);
    setConfirmedBooking(null);
    setBookingError("");
    setStep(1);
  }

  function selectBarber(id) {
    setBarberId(id);
    setDate(null);
    setTime(null);
    setShowPreview(false);
    setConfirmedBooking(null);
    setBookingError("");
    setStep(2);
  }

  function selectDate(next) {
    setDate(next);
    setTime(null);
  }

  function handleVerified(profile) {
    setVerified(Boolean(profile));
    setPerson(profile || { name: "", email: "", phone: "" });
    setShowPreview(false);
  }


  async function confirmBooking() {
    if (bookingBusy || !canReview || !date || !time || !serviceId || !barberId) return;
    setBookingBusy(true);
    setBookingError("");
    try {
      const response = await fetch("/api/booking/create", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, barberId, date, time }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { setVerified(false); setPerson({ name: '', email: '', phone: '' }); setShowPreview(false); }
        if (response.status === 409) {
          invalidateCachedAvailability(serviceId, barberId, date.slice(0, 7));
          setStep(2); setShowPreview(false); setTime(null); setRefreshAvailability(n => n + 1);
        }
        throw new Error(data.error || "Nem sikerült véglegesíteni a foglalást.");
      }
      invalidateCachedAvailability(serviceId, barberId, date.slice(0, 7));
      setConfirmedBooking(data.booking);
    } catch (error) { setBookingError(error.message); }
    finally { setBookingBusy(false); }
  }

  const { year, month } = monthParts(visibleMonth);
  const earliestMonth = monthIndex(today.date);
  const latestMonth = monthIndex(maxDate);

  return (
    <div className={styles.wrapper}>
      <aside className={styles.summary} aria-label="Várható összeg">
        <div className={styles.summaryBottom} aria-live="polite">
          <span>Várható összeg</span>
          <strong>{service ? formatPrice(service.price) : "— Ft"}</strong>
        </div>
      </aside>

      <section id="foglalasi-folyamat" ref={workspaceRef} className={styles.workspace} aria-label="Időpontfoglaló lépések">
        <div className={styles.topline}>
          <span>FOGLALÁSI FOLYAMAT</span>
        </div>

        <nav className={styles.steps} aria-label="Foglalási lépések">
          {STEPS.map((label, index) => (
            <button
              type="button"
              key={label}
              className={`${styles.step} ${step === index ? styles.stepActive : ""} ${index < step ? styles.stepFinished : ""}`}
              onClick={() => { if (canOpen(index)) { setStep(index); setShowPreview(false); } }}
              disabled={!canOpen(index)}
              aria-current={step === index ? "step" : undefined}
            >
              <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {step === 0 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>ELSŐ LÉPÉS</span>
                <h2>Miben segíthetünk?</h2>
                <p>Válaszd ki a neked megfelelő szolgáltatást.</p>
              </div>
              {catalogLoading && <p className={styles.noTimes}>Betöltjük a szolgáltatásokat…</p>}
              {catalogError && <p className={styles.noTimes} role="alert">{catalogError}</p>}
              {!catalogLoading && !catalogError && SERVICES.length === 0 && <p className={styles.noTimes}>A szolgáltatások még nincsenek aktiválva. Hamarosan foglalhatsz.</p>}
              <div className={styles.serviceList}>
                {SERVICES.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`${styles.serviceRow} ${serviceId === item.id ? styles.selectedRow : ""}`}
                    onClick={() => selectService(item.id)}
                    aria-pressed={serviceId === item.id}
                  >
                    <span className={styles.serviceNumber}>0{index + 1}</span>
                    <span className={styles.serviceText}><strong>{item.name}</strong><small>{item.description}</small></span>
                    <span className={styles.serviceMeta}><strong>{formatPrice(item.price)}</strong><small>{item.duration} perc</small></span>
                    <span className={styles.selectMark} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>MÁSODIK LÉPÉS</span>
                <h2>Kihez szeretnél menni?</h2>
                <p>Van kedvenc barbered? Válaszd ki. Ha nincs, segítünk.</p>
              </div>
              {BARBERS.length === 0 && <p className={styles.noTimes}>Jelenleg nincs aktív barber.</p>}
              <div className={styles.barberGrid}>
                <button
                  type="button"
                  disabled={BARBERS.length === 0}
                  className={`${styles.barberCard} ${styles.anyBarber} ${barberId === "any" ? styles.selectedBarber : ""}`}
                  onClick={() => selectBarber("any")}
                  aria-pressed={barberId === "any"}
                >
                  <span className={styles.anyVisual} aria-hidden="true">
                    {"✳\uFE0E"}
                  </span>                  <span className={styles.barberCardText}><strong>Bárki</strong><small>Nincs preferenciám</small></span>
                  <span className={styles.barberCheck} aria-hidden="true" />
                </button>
                {BARBERS.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`${styles.barberCard} ${barberId === item.id ? styles.selectedBarber : ""}`}
                    onClick={() => selectBarber(item.id)}
                    aria-pressed={barberId === item.id}
                  >
                    <span className={styles.barberImage} style={item.image ? { backgroundImage: `url('${item.image}')` } : undefined} aria-hidden="true" />
                    <span className={styles.barberCardText}><strong>{item.name}</strong><small>{item.role}</small></span>
                    <span className={styles.barberCheck} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>HARMADIK LÉPÉS</span>
                <h2>Találjuk meg a napod.</h2>
                <p>Válassz egy napot a naptárból, majd egy kezdési időpontot.</p>
              </div>
              <div className={styles.dateGrid}>
                <div className={styles.calendar}>
                  <div className={styles.calendarHead}>
                    <h3>{MONTHS[month]} <span>{year}</span></h3>
                    <div className={styles.monthControls}>
                      <button type="button" aria-label="Előző hónap" onClick={() => { setDate(null); setTime(null); setVisibleMonth((m) => Math.max(earliestMonth, m - 1)); }} disabled={visibleMonth <= earliestMonth}>Előző</button>
                      <button type="button" aria-label="Következő hónap" onClick={() => { setDate(null); setTime(null); setVisibleMonth((m) => Math.min(latestMonth, m + 1)); }} disabled={visibleMonth >= latestMonth}>Következő</button>
                    </div>
                  </div>
                  <div className={styles.weekdays}>{WEEKDAYS.map((name) => <span key={name}>{name}</span>)}</div>
                  <div className={styles.days} role="group" aria-label={`${year}. ${MONTHS[month]} naptár`}>
                    {calendar.map((iso, index) => {
                      if (!iso) return <span key={`blank-${index}`} className={styles.blankDay} aria-hidden="true" />;
                      const enabled = !availabilityLoading && Boolean(availableDays[iso]?.length) && iso >= today.date && iso <= maxDate;
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={!enabled}
                          onClick={() => selectDate(iso)}
                          className={`${styles.day} ${iso === date ? styles.daySelected : ""} ${iso === today.date ? styles.dayToday : ""}`}
                          aria-pressed={iso === date}
                          aria-label={formatDay(iso)}
                        >{Number(iso.slice(-2))}</button>
                      );
                    })}
                  </div>
                  <p className={styles.calendarNote}><span className={styles.noteDot} /> A szabad napok választhatók · Legfeljebb 60 napra előre</p>
                </div>
                <div className={styles.timePanel}>
                  <div className={styles.timeHead}>
                    <span>ELÉRHETŐ KEZDÉSEK</span>
                    <strong>{date ? formatDay(date) : "Előbb válassz napot"}</strong>
                  </div>
                  {availabilityLoading && <p className={styles.noTimes}>Szabad időpontok betöltése…</p>}
                  {availabilityError && <p className={styles.noTimes} role="alert">{availabilityError}</p>}
                  {!availabilityLoading && !availabilityError && hasWorkingHours === false && (
                    <p className={styles.noTimes} role="status">Ehhez a barberhez még nincs munkaidő beállítva. A szalon tudja aktiválni a foglalható napokat.</p>
                  )}
                  {date && !availabilityLoading && !availabilityError ? (
                    <>
                      {slots.some((slot) => slot.available) ? (
                        <div className={styles.times} role="group" aria-label="Választható időpontok">
                          {slots.map((slot) => (
                            <button
                              key={slot.value}
                              type="button"
                              disabled={!slot.available}
                              className={`${styles.time} ${time === slot.value ? styles.timeSelected : ""}`}
                              onClick={() => setTime(slot.value)}
                              aria-pressed={time === slot.value}
                            >{slot.value}</button>
                          ))}
                        </div>
                      ) : <p className={styles.noTimes}>Erre a napra már nincs szabad időpont. Válassz másik napot.</p>}
                    </>
                  ) : !availabilityLoading && !availabilityError && hasWorkingHours !== false ? (
                    <div className={styles.emptyTimes}>
                      <span className={styles.emptyIcon} aria-hidden="true">◷</span>
                      <p>Kattints egy napra a naptárban, és itt megjelennek az időpontok.</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={styles.stepActions}>
                <button className={styles.textButton} type="button" onClick={() => setStep(1)}>Vissza a barberekhez</button>
                <button className={styles.mainButton} type="button" disabled={!date || !time} onClick={() => setStep(3)}>Tovább az adatokhoz</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>UTOLSÓ LÉPÉS</span>
                <h2>{confirmedBooking ? "A foglalásod sikeres." : showPreview ? "Ellenőrizd a részleteket." : "Azonosítsd magad."}</h2>
                <p>{confirmedBooking ? "Az időpontodat rögzítettük a rendszerben." : showPreview ? "Az időpont a véglegesítésig még szabad lehet másoknak is." : "E-mailes azonosítással gyorsan és biztonságosan foglalhatsz."}</p>
              </div>
              {confirmedBooking ? (
                <div className={styles.review} role="status" aria-live="polite">
                  <div className={styles.reviewAlert}><span aria-hidden="true">✓</span><div><strong>Időpont lefoglalva!</strong><p>Foglalási azonosító: {confirmedBooking.id}</p></div></div>
                  <dl>
                    <div><dt>Szolgáltatás</dt><dd>{confirmedBooking.service_name}</dd></div>
                    <div><dt>Barber</dt><dd>{confirmedBooking.staff_name}</dd></div>
                    <div><dt>Időpont</dt><dd>{formatDay(confirmedBooking.local_date)} · {confirmedBooking.local_time}</dd></div>
                    <div><dt>Ár</dt><dd>{formatPrice(confirmedBooking.price_huf)}</dd></div>
                  </dl>
                  <p className={styles.formNote}>A foglalásod elmentettük. A visszaigazoló e-mailben is megtalálod a foglaláskezelő hivatkozását.</p><a href="/foglalasaim" className={styles.mainButton} style={{ marginTop: 18 }}>Foglalásaim kezelése</a>
                </div>
              ) : !showPreview ? (
                <div className={styles.detailsAuth}>
                  <GuestIdentity onVerified={handleVerified} initialProfile={verified ? person : null} />
                  <div className={styles.stepActions}>
                    <button className={styles.textButton} type="button" onClick={() => setStep(2)}>Vissza az időponthoz</button>
                    <button className={styles.mainButton} type="button" disabled={!canReview} onClick={() => setShowPreview(true)}>Foglalás áttekintése</button>
                  </div>
                  <p className={styles.formNote}>Az e-mail-címedet ellenőriztük. A végleges foglalás egy külön gombbal történik.</p>
                </div>
              ) : (
                <div className={styles.review} role="region" aria-live="polite">
                  <dl>
                    <div><dt>Szolgáltatás</dt><dd>{service?.name} · {formatPrice(service?.price || 0)}</dd></div>
                    <div><dt>Barber</dt><dd>{barberId === "any" ? "Bármelyik elérhető barber" : barber?.name}</dd></div>
                    <div><dt>Nap és időpont</dt><dd>{formatDay(date)} · {time}</dd></div>
                    <div><dt>Név</dt><dd>{person.name}</dd></div>
                    <div><dt>Kapcsolat</dt><dd>{person.email} · {person.phone}</dd></div>
                  </dl>
                  {bookingError && <p role="alert" className={styles.noTimes}>{bookingError}</p>}
                  <div className={styles.stepActions}>
                    <button className={styles.textButton} type="button" disabled={bookingBusy} onClick={() => setShowPreview(false)}>Vissza az adatokhoz</button>
                    <button className={styles.mainButton} type="button" disabled={bookingBusy || !canReview} onClick={confirmBooking}>
                      {bookingBusy ? "FOGLALÁS FOLYAMATBAN…" : "IDŐPONT VÉGLEGESÍTÉSE"}
                    </button>
                  </div>
                </div>
              )}
              {bookingError && !showPreview && !confirmedBooking && <p role="alert" className={styles.noTimes}>{bookingError}</p>}
            </>
          )}
        </div>
        <div className={styles.demoFooter}><span>FOGLALÁS / PRESZTÍZS BARBER</span><span>EUROPE / Debrecen</span></div>
      </section>
    </div>
  );
}
