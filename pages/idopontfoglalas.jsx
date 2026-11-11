import { useState } from "react";
import Head from "next/head";
import BookingWizard from "../components/BookingWizard";
import styles from "../styles/BookingPage.module.css";

export default function BookingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <Head>
        <title>Időpontfoglalás | Presztízs Barber</title>
        <meta name="description" content="Válaszd ki a szolgáltatást, a barbert és a neked megfelelő időpontot a Presztízs Barber foglalási felületén." />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.page}>
        <header className={styles.header}>
          <a href="/" className={styles.brand} aria-label="Presztízs Barber — főoldal">Presztízs <em>Barber</em></a>
          <nav id="booking-page-menu" className={`${styles.headerRight} ${menuOpen ? styles.menuOpen : ""}`} aria-label="Foglalási navigáció">
            <a href="/foglalasaim" className={styles.back} onClick={() => setMenuOpen(false)}>Foglalásaim</a>
            <a href="/eszkozeim" className={styles.back} onClick={() => setMenuOpen(false)}>Eszközeim</a>
            <a href="/" className={styles.back} onClick={() => setMenuOpen(false)}>Vissza a főoldalra</a>
            <a href="#foglalasi-folyamat" className={styles.bookingPill} onClick={() => setMenuOpen(false)}>Időpontfoglalás</a>
          </nav>
          <button type="button" className={styles.menuToggle} aria-expanded={menuOpen} aria-controls="booking-page-menu" aria-label={menuOpen ? "Menü bezárása" : "Menü megnyitása"} onClick={() => setMenuOpen(value => !value)}>
            <span /><span /><span />
          </button>
        </header>
        <div className={styles.intro}>
          <div className={styles.introMeta}>01 / PRESZTÍZS BARBER</div>
          <div className={styles.introMain}>
            <h1>A következő <em>vágásod.</em></h1>
            <p>Válassz szolgáltatást, barbert és időpontot. A többit bízd ránk.</p>
          </div>
        </div>
        <BookingWizard />
        <footer className={styles.footer}>
          <span>© PRESZTÍZS BARBER</span>
          <span>MINDEN VÁGÁSNAK KARAKTERE VAN.</span>
        </footer>
      </main>
    </>
  );
}
