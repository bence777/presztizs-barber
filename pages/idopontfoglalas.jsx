import Head from "next/head";
import styles from "../styles/BookingPage.module.css";

export default function BookingPage() {
  return (
    <>
      <Head>
        <title>Időpontfoglalás | Presztízs Barber</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <header className={styles.header}>
          <a href="/" className={styles.brand}>PRESZTÍZS <em>Barber</em></a>
          <a href="/" className={styles.back}>VISSZA A FŐOLDALRA</a>
        </header>
        <section className={styles.content}>
          <span className={styles.eyebrow}>IDŐPONTFOGLALÁS</span>
          <h1>A következő<br /><em>vágásod.</em></h1>
          <p>Az online foglalórendszer még nincs összekötve az oldallal. Ez egy bemutató oldal; jelenleg nem lehet itt érvényes időpontot foglalni.</p>
          <a href="/" className={styles.button}>VISSZA A FŐOLDALRA</a>
        </section>
        <footer className={styles.foot}>PRESZTÍZS BARBER / MINDEN VÁGÁSNAK KARAKTERE VAN.</footer>
      </main>
    </>
  );
}
