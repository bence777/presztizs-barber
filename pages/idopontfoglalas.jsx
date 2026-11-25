import { useState } from "react";
import Head from "next/head";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../components/LanguageProvider";
import BookingWizard from "../components/BookingWizard";
import styles from "../styles/BookingPage.module.css";

export default function BookingPage() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <Head>
        <title>{t("Időpontfoglalás | DEMETERS")}</title>
        <meta name="description" content={t("Válaszd ki a barbert, a szolgáltatást és a neked megfelelő időpontot a DEMETERS foglalási felületén.")} />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.page}>
        <header className={styles.header}>
          <a href="/" className={styles.brand} aria-label={t("DEMETERS — főoldal")}>DEMETERS</a>
          <nav id="booking-page-menu" className={`${styles.headerRight} ${menuOpen ? styles.menuOpen : ""}`} aria-label={t("Foglalási navigáció")}>
            <a href="/foglalasaim" className={styles.back} onClick={() => setMenuOpen(false)}>{t("Foglalásaim")}</a>
            <a href="/eszkozeim" className={styles.back} onClick={() => setMenuOpen(false)}>{t("Eszközeim")}</a>
            <a href="/" className={styles.back} onClick={() => setMenuOpen(false)}>{t("Vissza a főoldalra")}</a>
            <a href="#foglalasi-folyamat" className={styles.bookingPill} onClick={() => setMenuOpen(false)}>{t("Időpontfoglalás")}</a>
          </nav>
          <div className={styles.headerControls}><LanguageSwitcher /><button type="button" className={styles.menuToggle} aria-expanded={menuOpen} aria-controls="booking-page-menu" aria-label={menuOpen ? t("Menü bezárása") : t("Menü megnyitása")} onClick={() => setMenuOpen(value => !value)}>
            <span /><span /><span />
          </button></div>
        </header>
        <div className={styles.intro}>
          <div className={styles.introMeta}>01 / DEMETERS</div>
          <div className={styles.introMain}>
            <h1>{t("A következő")}{" "}<em>{t("vágásod.")}</em></h1>
            <p>{t("Válassz barbert, szolgáltatást és időpontot. A többit bízd ránk.")}</p>
          </div>
        </div>
        <BookingWizard />
        <footer className={styles.footer}>
          <span>© DEMETERS</span>
          <span>DEMETERS / DEBRECEN</span>
        </footer>
      </main>
    </>
  );
}
