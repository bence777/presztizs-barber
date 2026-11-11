import Head from 'next/head';
import BookingIdentityGate from './BookingIdentityGate';
import BookingManageList from './BookingManageList';
import styles from '../styles/BookingManage.module.css';
export default function BookingManagePage({admin=false}) {
  const title=admin?'Foglaláskezelő':'Foglalásaim';
  return <><Head><title>{title} | Presztízs Barber</title><meta name="robots" content="noindex,nofollow,noarchive"/></Head>
    <main className={styles.page}><header className={styles.header}><a href="/" className={styles.brand}>Presztízs <em>Barber</em></a><nav><a href="/idopontfoglalas">IDŐPONTFOGLALÁS</a><a href="/eszkozeim">ESZKÖZEIM</a>{admin&&<a href="/foglalasaim">SAJÁT FOGLALÁSAIM</a>}</nav></header>
    <section className={styles.intro}><span className={styles.kicker}>{admin?'SZALON / ADMIN':'VENDÉGPROFIL / SAJÁT IDŐPONTOK'}</span><h1>{admin?'Foglalás':'A foglalás'}<em>{admin?'kezelő.':'aid.'}</em></h1><p>{admin?'A szalon időpontjai, vendégei és előzményei.':'Az összes közelgő és korábbi látogatásod egy helyen.'}</p></section>
    <BookingIdentityGate><BookingManageList admin={admin}/></BookingIdentityGate>
    <footer className={styles.footer}>PRESZTÍZS BARBER <span>EUROPE / BUDAPEST</span></footer></main></>;
}
