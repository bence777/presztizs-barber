import Head from "next/head";
import styles from "../styles/Home.module.css";
import HeroVideo from "../components/HeroVideo";
import Services from "../components/Services";
import BarberStack from "../components/BarberStack";
import SalonStory from "../components/SalonStory";
import TrustSection from "../components/TrustSection";
import BookingFooter from "../components/BookingFooter";

export default function Home() {
  return (
    <>
      <Head>
        <title>Presztízs Barber</title>
        <meta name="description" content="Presztízs Barber — precíz vágások, karakteres stílus." />
      </Head>
      <main id="teteje" className={styles.site}>
        <header className={styles.header}>
          <a className={styles.brand} href="#teteje">Presztízs <span>Barber</span></a>
          <nav aria-label="Fő navigáció">
            <a href="#szolgaltatasok">ÁRAK</a>
            <a href="#csapat">CSAPAT</a>
            <a href="#szalon">A SZALON</a>
            <a className={styles.bookingNav} href="/idopontfoglalas">FOGLALÁS</a>
          </nav>
        </header>

        <section className={styles.hero} aria-labelledby="hero-title">
          <HeroVideo />
          <div className={styles.portrait} aria-hidden="true" />
          <div className={styles.shade} aria-hidden="true" />
          <div className={styles.center}>
            <h1 id="hero-title">PRESZTÍZS <em>Barber</em></h1>
            <p>Minden vágásnak karaktere van</p>
          </div>
          <div className={styles.bottomline}>
            <span>GÖRGESS LEJJEBB</span>
            <a href="/idopontfoglalas">IDŐPONTFOGLALÁS</a>
          </div>
        </section>

        <Services />
        <BarberStack />
        <SalonStory />
        <TrustSection />
        <BookingFooter />
      </main>
    </>
  );
}
