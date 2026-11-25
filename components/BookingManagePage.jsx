import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from './LanguageProvider';
import Head from 'next/head';
import BookingIdentityGate from './BookingIdentityGate';
import BookingManageList from './BookingManageList';
import styles from '../styles/BookingManage.module.css';
export default function BookingManagePage({admin=false}) {
  const { t } = useLanguage();
  const title=admin?t("Foglaláskezelő"):t("Foglalásaim");
  return <><Head><title>{`${title} | DEMETERS`}</title><meta name="robots" content="noindex,nofollow,noarchive"/></Head>
    <main className={styles.page}><header className={styles.header}><a href="/" className={styles.brand}>DEMETERS</a><nav><a href="/idopontfoglalas">{t("IDŐPONTFOGLALÁS")}</a><a href="/eszkozeim">{t("ESZKÖZEIM")}</a>{admin&&<a href="/foglalasaim">{t("SAJÁT FOGLALÁSAIM")}</a>}<LanguageSwitcher /></nav></header>
    <section className={styles.intro}><span className={styles.kicker}>{admin?'SZALON / ADMIN':t("VENDÉGPROFIL / SAJÁT IDŐPONTOK")}</span><h1>{admin?t("Foglalás"):t("A foglalás")}<em>{admin?t("kezelő."):t("aid.")}</em></h1><p>{admin?t("A szalon időpontjai, vendégei és előzményei."):t("Az összes közelgő és korábbi látogatásod egy helyen.")}</p></section>
    <BookingIdentityGate><BookingManageList admin={admin}/></BookingIdentityGate>
    <footer className={styles.footer}>DEMETERS <span>EUROPE / Debrecen</span></footer></main></>;
}
