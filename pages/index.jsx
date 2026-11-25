import Head from 'next/head';
import styles from '../styles/Home.module.css';
import HeroVideo from '../components/HeroVideo';
import BarberStack from "../components/BarberStack";
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLanguage } from '../components/LanguageProvider';
import SalonStory from '../components/SalonStory';
import TrustSection from '../components/TrustSection';
import BookingFooter from '../components/BookingFooter';
export default function Home() {
  const { t } = useLanguage();
  return <>
    <Head><title>DEMETERS | Barber Debrecen</title><meta name="description" content={t("DEMETERS — precíz vágások, karakteres stílus. Online időpontfoglalás Debrecenben.")} /><meta property="og:site_name" content="DEMETERS"/><meta property="og:title" content="DEMETERS | Barber Debrecen"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@type':'HairSalon',name:'DEMETERS',areaServed:{'@type':'City',name:'Debrecen'}})}}/></Head>
    <main id="teteje" className={styles.site}>
      <header className={styles.header}>
        <a className={styles.brand} href="/">DEMETERS</a>
        <div className={styles.headerActions}><nav aria-label={t("Fő navigáció")}><a href="#szalon">{t("A SZALON")}</a><a href="#csapat">{t("CSAPAT")}</a><a className={styles.bookingNav} href="/idopontfoglalas">{t("FOGLALÁS")}</a></nav><LanguageSwitcher /></div>
      </header>
      <section className={styles.hero} aria-labelledby="hero-title">
        <HeroVideo />
        <div className={styles.portrait} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.center}><h1 id="hero-title">DEMETERS</h1></div>
        <div className={styles.bottomline}><span>{t("GÖRGESS LEJJEBB")}</span><a href="/idopontfoglalas">{t("IDŐPONTFOGLALÁS")}</a></div>
      </section>
      <SalonStory />
      <BarberStack />
      <TrustSection />
      <BookingFooter />
    </main>
  </>;
}
