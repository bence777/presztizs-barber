import Image from 'next/image';
import { trackEvent } from '../lib/client/analytics.mjs';
import Link from 'next/link';
import { SITE, route, bookingHref } from '../data/site.mjs';
import { COPY, SERVICE_CONTENT } from '../data/seoContent.mjs';
import { availableServiceKeys } from '../lib/seo/catalog.mjs';
import LanguageSwitcher from './LanguageSwitcher';
import styles from '../styles/Editorial.module.css';

export function PublicFooter({ language = 'hu', catalog }) {
  const c = COPY[language];
  return <footer className={styles.footer}>
    <div className={styles.footerBrand}><Link href={route('home', language)}>DEMETERS</Link><p>{c.footerLine}</p></div>
    <nav aria-label={language === 'en' ? 'Footer navigation' : 'Lábléc navigáció'}>{['prices', 'team', 'contact'].map(key => <Link key={key} href={route(key, language)}>{c[key]}</Link>)}<Link href={`${route('home', language)}#szalon`}>{language === 'en' ? 'The salon' : 'A szalon'}</Link><Link href={bookingHref(language)}>{c.book}</Link><Link href={route('privacy',language)}>{language==='en'?'Privacy notice':'Adatvédelmi tájékoztató'}</Link></nav>
    <nav aria-label={c.services}>{availableServiceKeys(catalog || { services: [] }).map(key => <Link key={key} href={route(key, language)}>{SERVICE_CONTENT[key][language].label}</Link>)}</nav>
    <address>DEMETERS / {SITE.city}{SITE.address && <span>{SITE.address.postalCode} {SITE.address.addressLocality}, {SITE.address.streetAddress}</span>}{SITE.phone && <a href={`tel:${SITE.phone.replace(/[^+\d]/g, '')}`} onClick={() => trackEvent('phone_clicked', { placement: 'footer' })}>{SITE.phone}</a>}{SITE.email && <a href={`mailto:${SITE.email}`}>{SITE.email}</a>}</address>
    <small>© {new Date().getFullYear()} DEMETERS</small>
  </footer>;
}
export function ClosingCta({ language = 'hu', barber, pageKey }) {
  const c = COPY[language];
  const titles = { prices: language === 'en' ? 'Found your next cut?' : 'Megvan a következő vágásod?', team: language === 'en' ? 'Who’s your barber?' : 'Te kit választasz?', contact: language === 'en' ? 'Let’s make it a date.' : 'Legyen egy időpontunk.', profile: language === 'en' ? 'See you in the chair.' : 'Találkozunk a székben.' };
  return <section className={styles.closing}><span className={styles.eyebrow}>DEMETERS / DEBRECEN</span><h2>{titles[pageKey] || c.closing}</h2><div><p>{c.closingText}</p><Link className={styles.button} href={bookingHref(language, barber)}>{c.book}</Link></div></section>;
}
export default function PublicLayout({ children, language = 'hu', catalog }) {
  const c = COPY[language];
  return <div className={styles.site}>
    <a className={styles.skip} href="#tartalom">{language === 'en' ? 'Skip to content' : 'Ugrás a tartalomra'}</a>
    <header className={styles.header}><Link className={styles.brand} href={route('home', language)} aria-label={`DEMETERS – ${c.home}`}><Image src="/images/demeters-logo.svg" alt="DEMETERS" width="180" height="24" /></Link><nav aria-label={language === 'en' ? 'Main navigation' : 'Fő navigáció'}>{['prices', 'team', 'contact'].map(key => <Link key={key} href={route(key, language)}>{c[key]}</Link>)}<Link className={styles.navBooking} href={bookingHref(language)}>{c.book}</Link></nav><LanguageSwitcher /></header>
    <main id="tartalom">{children}</main><PublicFooter language={language} catalog={catalog} />
  </div>;
}
