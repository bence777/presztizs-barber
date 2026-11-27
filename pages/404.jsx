import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Editorial.module.css';
export default function NotFound() {
  return <div className={styles.site}><Head><title>Az oldal nem található / Page not found | DEMETERS</title><meta name="robots" content="noindex,follow" key="robots" /></Head><main className={styles.pageWrap}><section className={styles.pageHero}><span className={styles.eyebrow}>DEMETERS / 404</span><h1>Ez az oldal nincs meg.</h1><p lang="en">This page could not be found.</p><Link className={styles.button} href="/">Főoldal</Link>{' '}<Link className={styles.button} href="/en">English home</Link></section></main></div>;
}
