import Link from 'next/link';
import { SITE, route, bookingHref } from '../data/site.mjs';
import { COPY } from '../data/seoContent.mjs';
import { trackEvent } from '../lib/client/analytics.mjs';
import PublicImage from './PublicImage';
import styles from '../styles/Editorial.module.css';
const DAYS = { Monday: ['Hétfő', 'Monday'], Tuesday: ['Kedd', 'Tuesday'], Wednesday: ['Szerda', 'Wednesday'], Thursday: ['Csütörtök', 'Thursday'], Friday: ['Péntek', 'Friday'], Saturday: ['Szombat', 'Saturday'], Sunday: ['Vasárnap', 'Sunday'] };
export default function LocationSection({ language = 'hu', full = false }) {
  const c = COPY[language];
  return <section className={styles.location} aria-labelledby="location-title" id="elerhetosegek">
    <div className={styles.locationLead}><span className={styles.eyebrow}>DEMETERS / {SITE.city.toUpperCase()}</span><h2 id="location-title">{c.localHeading}</h2><p>{c.localCopy}</p><Link href={full ? bookingHref(language) : route('contact', language)} className={styles.textLink}>{full ? c.book : c.contact} ↗</Link></div>
    <div className={styles.locationDetails}>
      <address><strong>DEMETERS</strong><span>{SITE.city}{SITE.district ? ` / ${SITE.district}` : ''}</span>{SITE.address && <span>{SITE.address.postalCode} {SITE.address.addressLocality}<br />{SITE.address.streetAddress}</span>}
        {SITE.phone && <a href={`tel:${SITE.phone.replace(/[^+\d]/g, '')}`} onClick={() => trackEvent('phone_clicked', { placement: 'location' })}>{SITE.phone}</a>}{SITE.email && <a href={`mailto:${SITE.email}`}>{SITE.email}</a>}
      </address>
      {SITE.openingHours.length > 0 && <div><h3>{c.openingHours}</h3>{SITE.openingHours.map((hours, index) => <p key={index}>{hours.dayOfWeek.map(day => DAYS[day]?.[language === 'en' ? 1 : 0] || day).join(', ')} · {hours.opens}–{hours.closes}</p>)}</div>}
      {SITE.mapsUrl && <a className={styles.textLink} href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('directions_clicked', { placement: 'location' })}>{c.directions} ↗</a>}
      {SITE.googleBusinessUrl && <a href={SITE.googleBusinessUrl} target="_blank" rel="noopener noreferrer">{c.google} ↗</a>}
      {SITE.parking[language] && <div><h3>{c.parking}</h3><p>{SITE.parking[language]}</p></div>}
      {SITE.transit[language] && <div><h3>{c.transit}</h3><p>{SITE.transit[language]}</p></div>}
    </div>
    {SITE.salonPhotos.slice(0, full ? 3 : 1).map(photo => <figure className={styles.salonPhoto} key={photo.src}><PublicImage src={photo.src} alt={language === 'en' ? photo.altEn || '' : photo.alt} /></figure>)}
  </section>;
}
