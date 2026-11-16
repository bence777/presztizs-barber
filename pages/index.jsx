import Head from 'next/head';
import styles from '../styles/Home.module.css';
import HeroVideo from '../components/HeroVideo';
import BarberStack from "../components/BarberStack";
import Services from "../components/Services";
export default function Home() {
  return <>
    <Head><title>DEMETERS | Barber Debrecen</title><meta name="description" content="DEMETERS — precíz vágások, karakteres stílus. Online időpontfoglalás Debrecenben." /><meta property="og:site_name" content="DEMETERS"/><meta property="og:title" content="DEMETERS | Barber Debrecen"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@type':'HairSalon',name:'DEMETERS',areaServed:{'@type':'City',name:'Debrecen'}})}}/></Head>
    <main className={styles.site}>
      <header className={styles.header}>
        <a className={styles.brand} href="/">DEMETERS</a>
        <nav aria-label="Fő navigáció"><a href="#munka">MUNKÁINK</a><a href="#rolunk">RÓLUNK</a><a href="#csapat">CSAPAT</a><a href="#foglalas">FOGLALÁS</a></nav>
      </header>
      <section className={styles.hero} aria-labelledby="hero-title">
        <HeroVideo />
        <div className={styles.portrait} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.center}><h1 id="hero-title">DEMETERS</h1><p>Minden vágásnak karaktere van</p></div>
        <div className={styles.bottomline}><span>SCROLL TO EXPLORE</span><a href="#foglalas">IDŐPONTFOGLALÁS</a></div>
      </section>
      <Services />
      <BarberStack />
    </main>
  </>;
}
