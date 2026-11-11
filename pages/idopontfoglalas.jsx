import Head from "next/head";
import BookingWizard from "../components/BookingWizard";
import styles from "../styles/BookingPage.module.css";

export default function BookingPage() {
  return (
    <>
      <Head>
        <title>Időpontfoglalás | Presztízs Barber</title>
        <meta name="description" content="Válaszd ki a szolgáltatást, a barbert és a neked megfelelő időpontot a Presztízs Barber foglalási felületén." />
        {/* Az adatkezelési tájékoztató élesítése után külön döntés az indexelésről. */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <header className={styles.header}>
          <a href="/" className={styles.brand} aria-label="Presztízs Barber — főoldal">Presztízs <em>Barber</em></a>
          <div className={styles.headerRight}>
            <span className={styles.headerTag}>ONLINE IDŐPONTFOGLALÁS</span>
            <a href="/foglalasaim" className={styles.back}>FOGLALÁSAIM ↗</a>
            <a href="/eszkozeim" className={styles.back}>ESZKÖZEIM ↗</a>
            <a href="/" className={styles.back}>VISSZA A FŐOLDALRA <span aria-hidden="true">↗</span></a>
          </div>
        </header>

        <div className={styles.intro}>
          <div className={styles.introMeta}>
            <span>01 / PRESZTÍZS BARBER</span>
            <span>EGYSZERŰ. GYORS. SZEMÉLYRE SZABOTT.</span>
          </div>
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
