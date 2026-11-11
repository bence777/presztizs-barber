import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../styles/GuestIdentity.module.css";

async function api(path, options) {
  const response = await fetch(`/api/guest/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...(options ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nem sikerült csatlakozni. Próbáld újra.");
  return data;
}

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function GuestIdentity({ onVerified, initialProfile = null }) {
  const [view, setView] = useState(initialProfile ? "ready" : "loading");
  const [email, setEmail] = useState(initialProfile?.email || "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [remember, setRemember] = useState(true);
  const [welcome, setWelcome] = useState(null);
  const [profile, setProfile] = useState(initialProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!initialProfile) {
      api("session")
        .then((result) => {
          if (!mounted.current) return;
          if (result.remembered) {
            setWelcome(result);
            setView("welcome");
          } else setView("email");
        })
        .catch((err) => {
          if (!mounted.current) return;
          setError(err.message);
          setView("unavailable");
        });
    }
    return () => { mounted.current = false; };
  }, []); // Run once: never reset an in-progress OTP entry on rerenders.

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const finish = useCallback((saved) => {
    setProfile(saved);
    setView("ready");
    setError("");
    onVerified(saved);
  }, [onVerified]);

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function newEmail() {
    run(async () => {
      await api("logout", {});
      onVerified(null);
      setWelcome(null);
      setProfile(null);
      setCode("");
      setEmail("");
      setName("");
      setPhone("");
      setView("email");
    });
  }

  function requestCode(event) {
    event?.preventDefault();
    if (!validEmail(email)) return setError("Adj meg egy érvényes e-mail-címet.");
    if (cooldown > 0) return;
    run(async () => {
      await api("send-code", { email: email.trim().toLowerCase() });
      setEmail((e) => e.trim().toLowerCase());
      setCooldown(60);
      setCode("");
      setView("code");
    });
  }

  function verifyCode(event) {
    event.preventDefault();
    if (!/^\d{6,10}$/.test(code)) return setError("6–10 számjegyből álló kódot adj meg.");
    run(async () => {
      const result = await api("verify-code", { email, code, remember });
      if (result.needsProfile) {
        setView("profile");
      } else finish(result.profile);
    });
  }

  function acceptRemembered() {
    run(async () => {
      const result = await api("me");
      if (result.needsProfile) {
        setEmail(result.email);
        setView("profile");
      } else finish(result.profile);
    });
  }

  function saveProfile(event) {
    event.preventDefault();
    run(async () => {
      const result = await api("profile", { name, phone });
      finish(result.profile);
    });
  }

  return (
    <div className={styles.container} aria-live="polite">
      {view === "loading" && (
        <div className={styles.loading}>Ellenőrizzük, hogy jártál-e már nálunk ezen az eszközön…</div>
      )}

      {view === "unavailable" && (
        <div className={styles.notice} role="alert">
          Az e-mailes azonosítás még nincs elérhető. A foglalási felület többi része kipróbálható.
        </div>
      )}

      {view === "welcome" && (
        <div className={styles.welcome}>
          <span className={styles.kicker}>ÜDV ÚJRA</span>
          <div className={styles.avatar} aria-hidden="true">{(welcome?.name || "V")[0].toUpperCase()}</div>
          <h3>Te vagy az, <em>{welcome?.name || "Vendég"}?</em></h3>
          <p>Korábban már azonosítottad magad ezen az eszközön.</p>
          <span className={styles.masked}>{welcome?.maskedEmail}</span>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" disabled={busy} onClick={acceptRemembered}>
              {busy ? "EGY PILLANAT…" : "IGEN, ÉN VAGYOK"}
            </button>
            <button className={styles.secondary} type="button" disabled={busy} onClick={newEmail}>NEM ÉN VAGYOK</button>
          </div>
          <p className={styles.disclaimer}>Megosztott eszközön válaszd a „Nem én vagyok” lehetőséget.</p>
        </div>
      )}

      {view === "email" && (
        <form className={styles.form} onSubmit={requestCode}>
          <span className={styles.kicker}>JELSZÓ NÉLKÜLI BEJELENTKEZÉS</span>
          <h3>Elég az <em>e-mail-címed.</em></h3>
          <p>Ha már foglaltál nálunk, automatikusan megtaláljuk az adataidat. Ha először jársz itt, azonosítás után kérjük be őket.</p>
          <label className={styles.field}>
            <span>E-MAIL-CÍM</span>
            <input type="email" autoComplete="email" autoFocus placeholder="nev@email.hu" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} />
          </label>
          <button className={styles.primary} disabled={busy || !validEmail(email)} type="submit">{busy ? "KÓD KÜLDÉSE…" : "ELLENŐRZŐ KÓD KÉRÉSE"}</button>
          <p className={styles.disclaimer}>Az e-mail-cím alapján nem jelenítünk meg más vendégek adatait. A hozzáféréshez kódos ellenőrzés szükséges.</p>
        </form>
      )}

      {view === "code" && (
        <form className={styles.form} onSubmit={verifyCode}>
          <span className={styles.kicker}>E-MAIL MEGERŐSÍTÉSE</span>
          <h3>Érkezett egy <em>kódod.</em></h3>
          <p>Elküldtük az ellenőrző kódot ide: <strong>{email}</strong></p>
          <label className={styles.field}>
            <span>ELLENŐRZŐ KÓD</span>
            <input
              className={styles.otp}
              type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}"
              maxLength={10} placeholder="Ellenőrző kód" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              required autoFocus
            />
          </label>
          <label className={styles.remember}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Emlékezzen rám ezen az eszközön 60 napig</span>
          </label>
          <button className={styles.primary} disabled={busy || (code.length < 6 || code.length > 10)} type="submit">{busy ? "ELLENŐRZÉS…" : "E-MAIL MEGERŐSÍTÉSE"}</button>
          <div className={styles.subActions}>
            <button type="button" disabled={busy || cooldown > 0} onClick={() => requestCode()}> {cooldown > 0 ? `ÚJ KÓD ${cooldown} MP MÚLVA` : "ÚJ KÓD KÉRÉSE"} </button>
            <button type="button" disabled={busy} onClick={() => { setView("email"); setCode(""); setError(""); }}>MÁSIK E-MAIL</button>
          </div>
          <p className={styles.disclaimer}>Ha nem érkezett meg, ellenőrizd a spam mappát is.</p>
        </form>
      )}

      {view === "profile" && (
        <form className={styles.form} onSubmit={saveProfile}>
          <span className={styles.kicker}>E-MAIL-CÍM ELLENŐRIZVE</span>
          <h3>Már csak <em>két adat.</em></h3>
          <p>Csak az első alkalommal kérjük be ezeket. Később a megerősített e-mail-címeddel visszakapod a profilodat.</p>
          <div className={styles.twoFields}>
            <label className={styles.field}><span>TELJES NÉV</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" required placeholder="Teljes neved" /></label>
            <label className={styles.field}><span>TELEFONSZÁM</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={24} autoComplete="tel" required placeholder="+36 30 123 4567" /></label>
          </div>
          <div className={styles.verifiedEmail}>MEGERŐSÍTVE · {email}</div>
          <p className={styles.disclaimer}>Az adatokat a vendégprofilodhoz kapcsoljuk a későbbi foglalások megkönnyítésére. Éles indulás előtt az adatkezelési tájékoztatót is közzé kell tenni.</p>
          <button className={styles.primary} disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, "").length < 7} type="submit">{busy ? "MENTÉS…" : "ADATOK MENTÉSE"}</button>
        </form>
      )}

      {view === "ready" && profile && (
        <div className={styles.ready}>
          <span className={styles.kicker}>AZONOSÍTÁS SIKERES</span>
          <h3>Üdv, <em>{profile.name.split(/\s+/)[0]}.</em></h3>
          <p>A vendégprofilod készen áll. Nem kell újra megadnod az adataidat.</p>
          <div className={styles.profileData}><span>NÉV</span><strong>{profile.name}</strong><span>E-MAIL</span><strong>{profile.email}</strong><span>TELEFON</span><strong>{profile.phone}</strong></div>
          <button type="button" className={styles.secondary} onClick={newEmail} disabled={busy}>NEM ÉN VAGYOK / KIJELENTKEZÉS</button>
        </div>
      )}

      {error && view !== "unavailable" && <div className={styles.error} role="alert">{error}</div>}
    </div>
  );
}
