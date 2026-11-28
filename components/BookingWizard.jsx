import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/client/analytics.mjs";
import { useRouter } from "next/router";
import { formatPrice } from "../data/bookingConfig";
import { getCachedAvailability, invalidateCachedAvailability, loadPublicAvailability, loadPublicCatalog, loadEarliestAppointment } from "../lib/client/bookingCache.mjs";
import { useLanguage } from "./LanguageProvider";
import { matchTeamMember, resolveBarberSelection } from "../data/team.mjs";
import BarberCarousel from "./BarberCarousel";
import GuestIdentity from "./GuestIdentity";
import styles from "../styles/BookingWizard.module.css";

const TIMEZONE = "Europe/Budapest";
const STEPS = ["Barber", "Szolgáltatás", "Időpont", "Adataid"];
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

function formatDay(iso, locale = "hu-HU") {
  if (!iso) return "Még nincs kiválasztva";
  return new Intl.DateTimeFormat(locale, {
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

export default function BookingWizard({ bookingRequest }) {
  const router = useRouter();
  const { t, locale, language } = useLanguage();
  const dayLabel = iso => iso ? formatDay(iso, locale) : t("Még nincs kiválasztva");
  const workspaceRef = useRef(null);
  const previousStepRef = useRef(0);
  const preselectionRef = useRef(null);
  const earliestRequestRef = useRef(null);
  const stepRef = useRef(0);
  const [today, setToday] = useState(getTodayInDebrecen);
  const [step, setStep] = useState(0);
  stepRef.current = step;
  const [earliestRequested, setEarliestRequested] = useState(false);
  const [earliestLoading, setEarliestLoading] = useState(false);
  const [earliestResult, setEarliestResult] = useState(null);
  const [earliestError, setEarliestError] = useState("");
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
  const selectedSlotRef=useRef({date,time});
  selectedSlotRef.current={date,time};
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const SERVICES = catalog.services.filter(item => barberId === 'any' || item.staffId === barberId);
  const BARBERS = catalog.barbers;
  const barberChoices = useMemo(() => [
    { id: 'any', name: t('Leghamarabbi időpont'), role: t('Az összes fodrász közül'), symbol: '◷' },
    ...BARBERS,
  ], [BARBERS, language]);

  useEffect(() => () => { earliestRequestRef.current?.abort(); earliestRequestRef.current = null; }, []);
  useEffect(() => {
    if (step !== 2 && earliestRequestRef.current) {
      earliestRequestRef.current.abort();
      earliestRequestRef.current = null;
      setEarliestLoading(false);
    }
  }, [step]);

  useEffect(() => {
    let active = true;
    loadPublicCatalog()
      .then(data => { if (active) setCatalog({ services: data.services || [], barbers: data.barbers || [] }); })
      .catch(error => { if (active) setCatalogError(error.message); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!serviceId || !barberId || earliestLoading || barberId === 'any' && earliestRequested) return;
    let active = true;
    const month = `${monthParts(visibleMonth).year}-${String(monthParts(visibleMonth).month + 1).padStart(2, "0")}`;
    const force = refreshAvailability !== lastRefreshRef.current;
    lastRefreshRef.current = refreshAvailability;
    const cached = !force && getCachedAvailability(serviceId, barberId, month);
    setAvailabilityError("");
    if (cached) {
      setAvailableDays(cached.days || {});
      setHasWorkingHours(cached.hasWorkingHours !== false);
      setAvailabilityLoading(false);
    } else if (!force) {
      setAvailableDays({});
      setHasWorkingHours(null);
      setAvailabilityLoading(true);
    }
    loadPublicAvailability(serviceId, barberId, month, { force })
      .then(data => {
        if (!active) return;
        setAvailableDays(data.days || {});
        setHasWorkingHours(data.hasWorkingHours !== false);
        const selected=selectedSlotRef.current;
        if(selected.date&&!data.days?.[selected.date]){setDate(null);setTime(null);setEarliestResult(null);}
        else if(selected.time&&!data.days?.[selected.date]?.some(slot=>slot.value===selected.time)){setTime(null);setEarliestResult(null);}
      })
      .catch(error => { if (active) setAvailabilityError(error.message); })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [serviceId, barberId, visibleMonth, refreshAvailability, earliestLoading, earliestRequested]);

  useEffect(()=>{
    if(!serviceId||!barberId||step!==2||earliestLoading||barberId==='any')return;
    const refresh=()=>{if(document.visibilityState==='visible')setRefreshAvailability(v=>v+1)};
    const timer=setInterval(refresh,15000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
  },[serviceId,barberId,step,earliestLoading]);

  // A szolgáltatás vagy barber előre kiválasztható a főoldalról:
  // /?service=skin-fade&barber=mark#foglalas
  useEffect(() => {
    if (!router.isReady || catalogLoading) return;
    const key = JSON.stringify([router.query.service, router.query.barber, router.query.barberName]);
    if (preselectionRef.current === key) return;
    preselectionRef.current = key;
    const barber = resolveBarberSelection(BARBERS, router.query);
    const service = catalog.services.find((item) => item.id === router.query.service && (barber?.id === 'any' || item.staffId === barber?.id));
    if (barber) { trackEvent('booking_started', { placement: 'deep_link', language }); trackEvent('barber_selected', { barber_id: barber.id, language }); }
    if (service && barber) { trackEvent('service_selected', { service_id: service.id, language }); setServiceId(service.id); } else setServiceId(null);
    if (barber) {
      setBarberId(barber.id);
      setEarliestRequested(barber.id === 'any');
      setEarliestResult(null);
      setDate(null);setTime(null);
    }
    if (service && barber) { setStep(2); if (barber.id === 'any') void findEarliest(service.id); }
    else if (barber) setStep(1);
  }, [router.isReady, router.query.service, router.query.barber, router.query.barberName, catalog, catalogLoading]);

  // A csapatkártya ugyanazzal a hivatkozással is új foglalást indíthat.
  useEffect(() => {
    if (!bookingRequest || catalogLoading) return;
    const member = resolveBarberSelection(BARBERS, { barber: bookingRequest.id, barberName: bookingRequest.name });
    if (member) selectBarber(member.id);
  }, [bookingRequest, catalogLoading, BARBERS]);

  // A felület állapotát Debrecen szerinti dátumhoz igazítjuk.
  useEffect(() => {
    const fresh = getTodayInDebrecen();
    setToday(fresh);
    setVisibleMonth((month) => Math.max(month, monthIndex(fresh.date)));
  }, []);

  // Lépésváltáskor a főoldalba ágyazott következő panelhez görgetünk.
  // Az első betöltéskor a főoldal tetején maradunk.
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    workspaceRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [step]);

  const service = SERVICES.find((item) => item.id === serviceId) || null;
  const barber = BARBERS.find((item) => item.id === barberId) || null;
  const maxDate = addDays(today.date, 60);
  const calendar = useMemo(() => createCalendar(visibleMonth), [visibleMonth]);
  const slots = date ? (availableDays[date] || []) : [];
  const canReview = verified && person.name.trim().length >= 2 && /.+@.+\..+/.test(person.email.trim()) && person.phone.replace(/\D/g, "").length >= 7;
  const canOpen = (index) => index === 0 || (index === 1 && Boolean(barberId)) ||
    (index === 2 && Boolean(serviceId && barberId)) ||
    (index === 3 && Boolean(serviceId && barberId && date && time));

  function selectService(id) {
    trackEvent('service_selected', { service_id: id, language });
    setServiceId(id);
    setDate(null);
    setTime(null);
    setShowPreview(false);
    setConfirmedBooking(null);
    setBookingError("");
    setStep(2);
    if (earliestRequested) void findEarliest(id);
  }

  function selectBarber(id) {
    trackEvent('booking_started', { placement: 'wizard', language });
    trackEvent('barber_selected', { barber_id: id, language });
    earliestRequestRef.current?.abort();
    earliestRequestRef.current = null;
    setEarliestLoading(false);
    setEarliestRequested(id === 'any');
    setEarliestResult(null);
    setEarliestError('');
    setBarberId(id);
    setServiceId(null);
    setDate(null);
    setTime(null);
    setShowPreview(false);
    setConfirmedBooking(null);
    setBookingError("");
    setStep(1);
  }

  function selectDate(next) {
    setEarliestRequested(false);
    setEarliestResult(null);
    setDate(next);
    setTime(null);
  }

  async function findEarliest(nextServiceId) {
    earliestRequestRef.current?.abort();
    const request = new AbortController();
    earliestRequestRef.current = request;
    setEarliestLoading(true);
    setEarliestResult(null);
    setEarliestError('');
    setDate(null);setTime(null);
    setAvailableDays({});setAvailabilityError('');setAvailabilityLoading(false);
    try {
      const data = await loadEarliestAppointment(nextServiceId, { signal: request.signal });
      if (request.signal.aborted || earliestRequestRef.current !== request || stepRef.current !== 2) return;
      if (!data.appointment) {
        setEarliestError('A következő 60 napban nincs szabad időpont.');
        return;
      }
      const appointment = data.appointment;
      setBarberId(appointment.barberId);
      setServiceId(appointment.serviceId || nextServiceId);
      setVisibleMonth(monthIndex(appointment.date));
      setDate(appointment.date);setTime(appointment.time);
      setEarliestResult(appointment);
    } catch (error) {
      if (!request.signal.aborted && earliestRequestRef.current === request) setEarliestError(error.message);
    } finally {
      if (earliestRequestRef.current === request) {
        earliestRequestRef.current = null;
        setEarliestLoading(false);
      }
    }
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
      const intent=JSON.stringify([serviceId,barberId,date,time]);
      let saved;try{saved=JSON.parse(sessionStorage.getItem('demeters-booking-intent'));}catch{}
      const idempotencyKey=saved?.intent===intent?saved.key:crypto.randomUUID();
      sessionStorage.setItem('demeters-booking-intent',JSON.stringify({intent,key:idempotencyKey}));
      const response = await fetch("/api/booking/create", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key":idempotencyKey },
        body: JSON.stringify({ serviceId, barberId, date, time }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { setVerified(false); setPerson({ name: '', email: '', phone: '' }); setShowPreview(false); }
        if (response.status === 409 && !['booking_quota','idempotency_conflict'].includes(data.code)) {
          invalidateCachedAvailability(serviceId, barberId, date.slice(0, 7));
          setStep(2); setShowPreview(false); setTime(null); setRefreshAvailability(n => n + 1);
          if (earliestRequested) void findEarliest(serviceId);
        }
        throw new Error(data.error || t("Nem sikerült véglegesíteni a foglalást."));
      }
      invalidateCachedAvailability(serviceId, barberId, date.slice(0, 7));
      if (!data.booking?.id) throw new Error(t("Nem sikerült véglegesíteni a foglalást."));
      sessionStorage.removeItem('demeters-booking-intent');
      setConfirmedBooking(data.booking);
      trackEvent('booking_completed', { barber_id: barberId, service_id: serviceId, language });
    } catch (error) { setBookingError(error.message); }
    finally { setBookingBusy(false); }
  }

  const { year, month } = monthParts(visibleMonth);
  const earliestMonth = monthIndex(today.date);
  const latestMonth = monthIndex(maxDate);

  return (
    <div className={styles.wrapper}>
      <aside className={styles.summary} aria-label={t("Foglalás összegzése")}>
        <nav className={styles.mobileSteps} aria-label={t("Foglalási lépések mobilon")}>
          {STEPS.map((label, index) => (
            <button
              type="button"
              key={label}
              className={`${styles.mobileStep} ${index === step ? styles.mobileStepActive : ""} ${index < step ? styles.mobileStepFinished : ""}`}
              onClick={() => { if (canOpen(index)) { setStep(index); setShowPreview(false); } }}
              disabled={!canOpen(index)}
              aria-current={index === step ? "step" : undefined}
            >
              <span className={styles.mobileStepCircle}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.mobileStepLabel}>{t(label)}</span>
            </button>
          ))}
        </nav>
        <div className={styles.summaryRows}>
          <div className={`${styles.summaryRow} ${step === 0 ? styles.summaryRowActive : ""}`}>
            <div>
              <small>{t("01 / BARBER")}</small>
              <strong>{barberId === "any" ? t("Leghamarabbi időpont") : barber?.name || t("Választásra vár")}</strong>
            </div>
            {barberId && <button type="button" onClick={() => { setStep(0); setShowPreview(false); }} aria-label={t("Barber módosítása")}>{t("Módosítás")}</button>}
          </div>
          <div className={`${styles.summaryRow} ${step === 1 ? styles.summaryRowActive : ""}`}>
            <div>
              <small>{t("02 / SZOLGÁLTATÁS")}</small>
              <strong>{t(service?.name) || t("Választásra vár")}</strong>
            </div>
            {service && <button type="button" onClick={() => { setStep(1); setShowPreview(false); }} aria-label={t("Szolgáltatás módosítása")}>{t("Módosítás")}</button>}
          </div>
          <div className={`${styles.summaryRow} ${step === 2 ? styles.summaryRowActive : ""}`}>
            <div>
              <small>{t("03 / IDŐPONT")}</small>
              <strong>{date ? `${date.slice(5).replace("-", ".")}. · ${time || t("Válassz időpontot")}` : t("Választásra vár")}</strong>
            </div>
            {date && <button type="button" onClick={() => { setStep(2); setShowPreview(false); }} aria-label={t("Időpont módosítása")}>{t("Módosítás")}</button>}
          </div>
          <div className={`${styles.summaryRow} ${step === 3 ? styles.summaryRowActive : ""}`}>
            <div>
              <small>{t("04 / ADATAID")}</small>
              <strong>{verified ? person.name : t("Választásra vár")}</strong>
            </div>
            {verified && <button type="button" onClick={() => { setStep(3); setShowPreview(false); }} aria-label={t("Adataid módosítása")}>{t("Módosítás")}</button>}
          </div>
        </div>
        {service && <div className={styles.summaryBottom} aria-live="polite">
          <span>{t("Várható összeg")}</span>
          <strong>{barberId && service ? formatPrice(service.price) : "— Ft"}</strong>
        </div>}
      </aside>

      <section id="foglalasi-folyamat" ref={workspaceRef} className={styles.workspace} aria-label={t("Időpontfoglaló lépések")}>
        <nav className={styles.steps} aria-label={t("Foglalási lépések")}>
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
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>

        <div className={`${styles.content} ${step === 0 ? styles.barberContent : ""}`}>
          {step === 0 && (
            <>
              <div className={styles.sectionHead}>
                <h2 className={styles.barberHeading}>{t("Válassz fodrászt")}</h2>
              </div>
              {!catalogLoading && !catalogError && router.query.barberName && !matchTeamMember(BARBERS, router.query.barberName) && <p className={styles.noTimes} role="status">{t("A kiválasztott fodrász jelenleg nem foglalható online. Válassz az elérhető csapattagok közül.")}</p>}
              {catalogLoading && <p className={styles.noTimes}>{t("Betöltjük a fodrászokat…")}</p>}
              {catalogError && <p className={styles.noTimes} role="alert">{t(catalogError)}</p>}
              {!catalogLoading && !catalogError && BARBERS.length === 0 && <p className={styles.noTimes}>{t("Jelenleg nincs aktív barber.")}</p>}
              {!catalogLoading && !catalogError && BARBERS.length > 0 && <BarberCarousel
                compact
                barbers={barberChoices}
                initialBarberId={barberId || 'any'}
                onChoose={member => selectBarber(member.id)}
              />}
              <p className={styles.individualPrices}>{t("Minden fodrász egyéni árakon dolgozik.")}</p>
            </>
          )}

          {step === 1 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>{t("MÁSODIK LÉPÉS")}</span>
                <h2>{t("Miben segíthetünk?")}</h2>
                <p>{t("Válaszd ki a neked megfelelő szolgáltatást.")}</p>
              </div>
              {catalogLoading && <p className={styles.noTimes}>{t("Betöltjük a szolgáltatásokat…")}</p>}
              {catalogError && <p className={styles.noTimes} role="alert">{t(catalogError)}</p>}
              {!catalogLoading && !catalogError && SERVICES.length === 0 && <p className={styles.noTimes}>{t("A szolgáltatások még nincsenek aktiválva. Hamarosan foglalhatsz.")}</p>}
              <button className={styles.textButton} type="button" onClick={() => setStep(0)}>{t("Vissza a barberekhez")}</button>
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
                    <span className={styles.serviceText}><strong>{t(item.name)}</strong><small>{barberId === 'any' ? `${BARBERS.find(b=>b.id===item.staffId)?.name || ''}${item.description ? ' · ' : ''}` : ''}{t(item.description)}</small></span>
                    <span className={styles.serviceMeta}><strong>{formatPrice(item.price)}</strong><small>{item.duration}{" "}{t("perc")}</small></span>
                    <span className={styles.selectMark} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>{t("HARMADIK LÉPÉS")}</span>
                <h2>{t("Találjuk meg a napod.")}</h2>
                <p>{t("Válassz egy napot a naptárból, majd egy kezdési időpontot.")}</p>
              </div>
              {bookingError && <p className={styles.noTimes} role="alert">{t(bookingError)}</p>}
              {earliestLoading && <p className={styles.earliestNotice} role="status">{t("Megkeressük a legkorábbi szabad időpontot az összes fodrásznál…")}</p>}
              {earliestError && <p className={styles.earliestNotice} role="alert">{t(earliestError)}</p>}
              {earliestResult && <div className={styles.earliestNotice} role="status">
                <strong>{t("A legkorábbi szabad időpont")}</strong>
                <span>{earliestResult.barberName} · {dayLabel(earliestResult.date)} · {earliestResult.time}</span>
              </div>}
              {earliestRequested && !earliestLoading && <button type="button" className={styles.textButton} onClick={() => void findEarliest(serviceId)}>{t("Leghamarabbi időpont újrakeresése")}</button>}
              <div className={styles.dateGrid}>
                <div className={styles.calendar}>
                  <div className={styles.calendarHead}>
                    <h3>{t(MONTHS[month])} <span>{year}</span></h3>
                    <div className={styles.monthControls}>
                      <button type="button" aria-label={t("Előző hónap")} onClick={() => { setDate(null); setTime(null); setEarliestResult(null); setEarliestRequested(false); setVisibleMonth((m) => Math.max(earliestMonth, m - 1)); }} disabled={earliestLoading || visibleMonth <= earliestMonth}>{t("Előző")}</button>
                      <button type="button" aria-label={t("Következő hónap")} onClick={() => { setDate(null); setTime(null); setEarliestResult(null); setEarliestRequested(false); setVisibleMonth((m) => Math.min(latestMonth, m + 1)); }} disabled={earliestLoading || visibleMonth >= latestMonth}>{t("Következő")}</button>
                    </div>
                  </div>
                  <div className={styles.weekdays}>{(language === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : WEEKDAYS).map((name, index) => <span key={index}>{name}</span>)}</div>
                  <div className={styles.days} role="group" aria-label={`${year}. ${t(MONTHS[month])} ${t("naptár")}`}>
                    {calendar.map((iso, index) => {
                      if (!iso) return <span key={`blank-${index}`} className={styles.blankDay} aria-hidden="true" />;
                      const enabled = !earliestLoading && !availabilityLoading && Boolean(availableDays[iso]?.length) && iso >= today.date && iso <= maxDate;
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={!enabled}
                          onClick={() => selectDate(iso)}
                          className={`${styles.day} ${iso === date ? styles.daySelected : ""} ${iso === today.date ? styles.dayToday : ""}`}
                          aria-pressed={iso === date}
                          aria-label={dayLabel(iso)}
                        >{Number(iso.slice(-2))}</button>
                      );
                    })}
                  </div>
                  <p className={styles.calendarNote}><span className={styles.noteDot} />{" "}{t("A szabad napok választhatók · Legfeljebb 60 napra előre")}</p>
                </div>
                <div className={styles.timePanel}>
                  <div className={styles.timeHead}>
                    <span>{t("ELÉRHETŐ KEZDÉSEK")}</span>
                    <strong>{date ? dayLabel(date) : t("Előbb válassz napot")}</strong>
                  </div>
                  {availabilityLoading && <p className={styles.noTimes}>{t("Szabad időpontok betöltése…")}</p>}
                  {availabilityError && <p className={styles.noTimes} role="alert">{t(availabilityError)}</p>}
                  {!availabilityLoading && !availabilityError && hasWorkingHours === false && (
                    <p className={styles.noTimes} role="status">{t("Ehhez a barberhez még nincs munkaidő beállítva. A szalon tudja aktiválni a foglalható napokat.")}</p>
                  )}
                  {date && !availabilityLoading && !availabilityError ? (
                    <>
                      {slots.some((slot) => slot.available) ? (
                        <div className={styles.times} role="group" aria-label={t("Választható időpontok")}>
                          {slots.map((slot) => (
                            <button
                              key={slot.value}
                              type="button"
                              disabled={!slot.available}
                              className={`${styles.time} ${time === slot.value ? styles.timeSelected : ""}`}
                              onClick={() => { setEarliestRequested(false); setEarliestResult(null); setTime(slot.value); }}
                              aria-pressed={time === slot.value}
                            >{slot.value}</button>
                          ))}
                        </div>
                      ) : <p className={styles.noTimes}>{t("Erre a napra már nincs szabad időpont. Válassz másik napot.")}</p>}
                    </>
                  ) : !availabilityLoading && !availabilityError && hasWorkingHours !== false ? (
                    <div className={styles.emptyTimes}>
                      <span className={styles.emptyIcon} aria-hidden="true">◷</span>
                      <p>{t("Kattints egy napra a naptárban, és itt megjelennek az időpontok.")}</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={styles.stepActions}>
                <button className={styles.textButton} type="button" onClick={() => setStep(1)}>{t("Vissza a szolgáltatásokhoz")}</button>
                <button className={styles.mainButton} type="button" disabled={!date || !time || earliestLoading || availabilityLoading} onClick={() => setStep(3)}>{t("Tovább az adatokhoz")}</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>{t("UTOLSÓ LÉPÉS")}</span>
                <h2>{confirmedBooking ? t("A foglalásod sikeres.") : showPreview ? t("Ellenőrizd a részleteket.") : t("Azonosítsd magad.")}</h2>
                <p>{confirmedBooking ? t("Az időpontodat rögzítettük a rendszerben.") : showPreview ? t("Az időpont a véglegesítésig még szabad lehet másoknak is.") : t("E-mailes azonosítással gyorsan és biztonságosan foglalhatsz.")}</p>
              </div>
              {confirmedBooking ? (
                <div className={styles.review} role="status" aria-live="polite">
                  <div className={styles.reviewAlert}><span aria-hidden="true">✓</span><div><strong>{t("Időpont lefoglalva!")}</strong><p>{t("Foglalási azonosító:")}{" "}{confirmedBooking.id}</p></div></div>
                  <dl>
                    <div><dt>{t("Szolgáltatás")}</dt><dd>{t(confirmedBooking.service_name)}</dd></div>
                    <div><dt>Barber</dt><dd>{confirmedBooking.staff_name}</dd></div>
                    <div><dt>{t("Időpont")}</dt><dd>{dayLabel(confirmedBooking.local_date)} · {confirmedBooking.local_time}</dd></div>
                    <div><dt>{t("Ár")}</dt><dd>{formatPrice(confirmedBooking.price_huf)}</dd></div>
                  </dl>
                  <p className={styles.formNote}>{t("A foglalásod elmentettük. A visszaigazoló e-mailben is megtalálod a foglaláskezelő hivatkozását.")}</p><a href={language === "en" ? "/foglalasaim?lang=en" : "/foglalasaim"} className={styles.mainButton} style={{ marginTop: 18 }}>{t("Foglalásaim kezelése")}</a>
                </div>
              ) : !showPreview ? (
                <div className={styles.detailsAuth}>
                  <GuestIdentity onVerified={handleVerified} initialProfile={verified ? person : null} />
                  <div className={styles.stepActions}>
                    <button className={styles.textButton} type="button" onClick={() => setStep(2)}>{t("Vissza az időponthoz")}</button>
                    <button className={styles.mainButton} type="button" disabled={!canReview} onClick={() => setShowPreview(true)}>{t("Foglalás áttekintése")}</button>
                  </div>
                  <p className={styles.formNote}>{t("Az e-mail-címedet ellenőriztük. A végleges foglalás egy külön gombbal történik.")}</p>
                </div>
              ) : (
                <div className={styles.review} role="region" aria-live="polite">
                  <dl>
                    <div><dt>{t("Szolgáltatás")}</dt><dd>{t(service?.name)} · {formatPrice(service?.price || 0)}</dd></div>
                    <div><dt>Barber</dt><dd>{barberId === "any" ? t("Leghamarabbi időpont") : barber?.name}</dd></div>
                    <div><dt>{t("Nap és időpont")}</dt><dd>{dayLabel(date)} · {time}</dd></div>
                    <div><dt>{t("Név")}</dt><dd>{person.name}</dd></div>
                    <div><dt>{t("Kapcsolat")}</dt><dd>{person.email} · {person.phone}</dd></div>
                  </dl>
                  {bookingError && <p role="alert" className={styles.noTimes}>{t(bookingError)}</p>}
                  <div className={styles.stepActions}>
                    <button className={styles.textButton} type="button" disabled={bookingBusy} onClick={() => setShowPreview(false)}>{t("Vissza az adatokhoz")}</button>
                    <button className={styles.mainButton} type="button" disabled={bookingBusy || !canReview} onClick={confirmBooking}>
                      {bookingBusy ? t("FOGLALÁS FOLYAMATBAN…") : t("IDŐPONT VÉGLEGESÍTÉSE")}
                    </button>
                  </div>
                </div>
              )}
              {bookingError && !showPreview && !confirmedBooking && <p role="alert" className={styles.noTimes}>{t(bookingError)}</p>}
            </>
          )}
        </div>
        <div className={styles.demoFooter}><span>{t("FOGLALÁS / DEMETERS")}</span><span>EUROPE / Debrecen</span></div>
      </section>
    </div>
  );
}
