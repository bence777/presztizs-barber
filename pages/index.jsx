import DemetersLogo from '../components/DemetersLogo';
import Link from 'next/link';
import Seo from '../components/Seo';
import PortfolioGallery from '../components/PortfolioGallery';
import Faq from '../components/Faq';
import LocationSection from '../components/LocationSection';
import { COPY, pageMetadata, homeFaq } from '../data/seoContent.mjs';
import { route, profilePath } from '../data/site.mjs';
import { profileAvailable } from '../lib/seo/catalog.mjs';
import { buildSchema } from '../lib/seo/schema.mjs';
import editorial from '../styles/Editorial.module.css';
import { useState } from 'react';
import styles from '../styles/Home.module.css';
import HeroVideo from '../components/HeroVideo';
import BarberStack from '../components/BarberStack';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLanguage } from '../components/LanguageProvider';
import SalonStory from '../components/SalonStory';
import TrustSection from '../components/TrustSection';
import BookingFooter from '../components/BookingFooter';
import { PublicFooter } from '../components/PublicLayout';


export default function Home({ catalog, language = 'hu' }) {
  const { t } = useLanguage();
  const meta = pageMetadata('home', language);
  const c = COPY[language];
  const [bookingRequest, setBookingRequest] = useState(null);

  return (
    <>
      <Seo {...meta} path={route('home', language)} language={language} alternates={{ 'hu-HU': '/', en: '/en', 'x-default': '/' }} schema={buildSchema({ ...meta, path: route('home', language), language, catalog })} />

      <main id="teteje" className={styles.site}>
        <header className={styles.header}>
          <a
            className={styles.brand}
            href={route('home', language)}
            aria-label={`DEMETERS – ${c.home}`}
          >
            <DemetersLogo className={styles.navLogo} />
          </a>

          <div className={styles.headerActions}>
            <nav aria-label={t("Fő navigáció")}>
              <Link href={route('prices', language)}>{c.prices}</Link>
              <Link href={route('team', language)}>{c.team}</Link>

              <a
                className={styles.bookingNav}
                href="#foglalas"
              >
                {t("FOGLALÁS")}
              </a>
            </nav>

            <LanguageSwitcher />
          </div>
        </header>

        <section
          className={styles.hero}
          aria-labelledby="hero-title"
        >
          <HeroVideo />

          <div
            className={styles.portrait}
            aria-hidden="true"
          />

          <div
            className={styles.shade}
            aria-hidden="true"
          />

          <div className={styles.center}>
            <DemetersLogo className={styles.heroLogo} />

            <h1
              id="hero-title"
              className={styles.heroTitle}
            >
              {meta.h1}
            </h1>
            <a className={styles.heroBooking} href="#foglalas">{t("IDŐPONTFOGLALÁS")}</a>
          </div>

          <div className={styles.bottomline}>
            <span>{t("GÖRGESS LEJJEBB")}</span>

          </div>
        </section>

        <BarberStack
          initialBarbers={catalog.barbers}
          onBook={barber =>
            setBookingRequest({
              id: barber.id,
              name: barber.name,
            })
          }
        />

        <nav className={editorial.homeLinks} aria-label={c.team}>
          <Link href={route('team', language)}>{c.team}</Link>
          {catalog.barbers.filter(barber => profileAvailable(barber, catalog, language)).map(barber => <Link key={barber.id} href={profilePath(barber.slug, language)}>{barber.name}</Link>)}
        </nav>
        <BookingFooter bookingRequest={bookingRequest} catalog={catalog} showFooter={false} />
        <TrustSection />
        <div className={editorial.homeBlock}>
          <PortfolioGallery catalog={catalog} language={language} />
          <LocationSection language={language} />
          <Faq items={homeFaq(catalog, language)} title={c.faq} />
        </div>

        <SalonStory />
        <PublicFooter language={language} catalog={catalog} />
      </main>
    </>
  );
}

export async function getStaticProps() {
  const { homeProps } = await import('../lib/server/publicPages');
  return homeProps('hu');
}
