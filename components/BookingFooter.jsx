import { useLanguage } from './LanguageProvider';
import styles from "../styles/BookingFooter.module.css";

export default function BookingFooter() {
  const { t } = useLanguage();
  return (
    <>
      <section id="foglalas" className={styles.cta} aria-labelledby="booking-heading">
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
              <a className={styles.button} href="/idopontfoglalas">{t("IDŐPONTOT FOGLALOK")}</a>
            </div>
          </div>
          <div className={styles.bottomline}>
            <span>DEMETERS / DEBRECEN</span>
            <span>DEMETERS</span>
          </div>
        </div>
      </section>
      <footer className={styles.footer} id="kapcsolat">
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <a className={styles.brand} href="#teteje" aria-label={t("DEMETERS – az oldal tetejére")}>
              DEMETERS
            </a>
            <nav aria-label={t("Lábléc navigáció")} className={styles.links}>
              <a href="/idopontfoglalas">{t("Szolgáltatások és árak")}</a>
              <a href="#csapat">{t("A csapat")}</a>
              <a href="#szalon">{t("A szalon")}</a>
              <a href="/idopontfoglalas">{t("Foglalás")}</a>
            </nav>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} DEMETERS</span>
            <span>DEMETERS / DEBRECEN</span>
            <a href="#teteje">{t("VISSZA AZ ELEJÉRE")}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
