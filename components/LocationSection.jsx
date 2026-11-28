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
    <div className={styles.locationLead}><span className={styles.eyebrow}>DEMETERS / {SITE.city.toUpperCase()}</span><h2 id="location-title">{c.localHeading}</h2><p>{c.localCopy}</p><Link href={full ? bookingHref(language) : route('contact', language)} className={styles.textLink}>{full ? c.book : c.contact}</Link></div>
    <div className={styles.locationDetails}>
      <iframe title={language==='en'?'DEMETERS location: Debrecen, Csapó utca 13.':'DEMETERS térkép: Debrecen, Csapó utca 13.'} src="https://www.google.com/maps?q=Debrecen%2C%20Csap%C3%B3%20utca%2013&output=embed" width="600" height="360" style={{width:'100%',border:0,maxWidth:'100%'}} loading="lazy" referrerPolicy="no-referrer" allowFullScreen />
      <p>Debrecen, Csapó utca 13.</p>
      {SITE.openingHours.length > 0 && <div><h3>{c.openingHours}</h3>{SITE.openingHours.map((hours, index) => <p key={index}>{hours.dayOfWeek.map(day => DAYS[day]?.[language === 'en' ? 1 : 0] || day).join(', ')} · {hours.opens}–{hours.closes}</p>)}</div>}
      {SITE.mapsUrl && <a className={styles.textLink} href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('directions_clicked', { placement: 'location' })}>{c.directions}</a>}
      {SITE.googleBusinessUrl && <a href={SITE.googleBusinessUrl} target="_blank" rel="noopener noreferrer">{c.google}</a>}
      {SITE.parking[language] && <div><h3>{c.parking}</h3><p>{SITE.parking[language]}</p></div>}
      {SITE.transit[language] && <div><h3>{c.transit}</h3><p>{SITE.transit[language]}</p></div>}
    </div>
    {SITE.salonPhotos.slice(0, full ? 3 : 1).map(photo => <figure className={styles.salonPhoto} key={photo.src}><PublicImage src={photo.src} alt={language === 'en' ? photo.altEn || '' : photo.alt} /></figure>)}
  </section>;
}
