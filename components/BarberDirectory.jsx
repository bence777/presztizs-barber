import Link from 'next/link';
import { bookingHref, profilePath, route } from '../data/site.mjs';
import { COPY } from '../data/seoContent.mjs';
import { profileAvailable, priceRange } from '../lib/seo/catalog.mjs';
import PublicImage from './PublicImage';
import styles from '../styles/Editorial.module.css';
export default function BarberDirectory({ catalog, language = 'hu', barbers = catalog.barbers }) {
  const c = COPY[language];
  return <div className={styles.directory}>{barbers.map((barber, index) => <article key={barber.id} className={styles.barberEntry}>
    {barber.image ? <div className={styles.directoryPortrait}><PublicImage src={barber.image} alt={barber.name} sizes="(max-width: 700px) 85vw, 32vw" /><small>{String(index + 1).padStart(2, '0')} / DEMETERS</small></div> : <div className={styles.directoryIndex}><span>{String(index + 1).padStart(2, '0')}</span><span>DEMETERS / BARBER</span></div>}
    <div className={styles.barberInfo}><h2>{barber.name}</h2>{(language === 'en' ? barber.bioEn : barber.bio) && <p>{language === 'en' ? barber.bioEn : barber.bio}</p>}<span>{priceRange(catalog.services.filter(service => service.staffId === barber.id), language)}</span>
      <div className={styles.directoryLinks}>{profileAvailable(barber, catalog, language) && <Link href={profilePath(barber.slug, language)}>{c.profile} ↗</Link>}<Link href={`${route('prices', language)}#barber-${barber.id}`}>{c.services} ↗</Link><Link href={bookingHref(language, barber)}>{c.book} ↗</Link></div>
    </div>
  </article>)}</div>;
}
