import { useLanguage } from './LanguageProvider';
import DeferredBooking from './DeferredBooking';
import { PublicFooter } from './PublicLayout';
import styles from "../styles/BookingFooter.module.css";

export default function BookingFooter({ bookingRequest, catalog, showFooter = true, showIntro = true }) {
  const { t, language } = useLanguage();
  return (
    <>
      {showIntro && <section className={styles.cta} aria-labelledby="booking-heading">
        <div className={styles.backdrop} aria-hidden="true" />
        <div className={styles.wrap}>
          <div className={styles.topline}>
            <span>{t("IDŐPONTFOGLALÁS")}</span>
            <span>DEMETERS</span>
          </div>
          <div className={styles.center}>
            <span className={styles.overTitle}>{t("A KÖVETKEZŐ VÁGÁSOD")}</span>
            <h2 id="booking-heading">{t("A szék")}<br /><em>{t("rád vár.")}</em></h2>
            <div className={styles.actionRow}>
              <p className={styles.intro}>{t("Válassz barbert, szolgáltatást és időpontot.")}<br />{t("Ennyi az egész.")}</p>
              <a className={styles.button} href="#foglalas">{t("IDŐPONTOT FOGLALOK")}</a>
            </div>
          </div>
          <div className={styles.bottomline}>
            <span>DEMETERS / DEBRECEN</span>
            <span>DEMETERS</span>
          </div>
        </div>
      </section>}
      <section id="foglalas" className={styles.booking} aria-label={t("Időpontfoglalás")}>
        <div className={styles.bookingHeader}>
          <span>{t("IDŐPONTFOGLALÁS")}</span>
          <nav aria-label={t("Foglalási navigáció")}>
            <a href={language === 'en' ? '/foglalasaim?lang=en' : '/foglalasaim'}>{t("Foglalásaim")}</a>
            <a href={language === 'en' ? '/eszkozeim?lang=en' : '/eszkozeim'}>{t("Eszközeim")}</a>
          </nav>
        </div>
        <DeferredBooking bookingRequest={bookingRequest} />
      </section>
      {showFooter && <PublicFooter language={language} catalog={catalog} />}
    </>
  );
}
