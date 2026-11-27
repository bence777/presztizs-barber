import Link from 'next/link';
import { profilePath } from '../data/site.mjs';
import { profileAvailable } from '../lib/seo/catalog.mjs';
import PublicImage from './PublicImage';
import styles from '../styles/Editorial.module.css';
export default function PortfolioGallery({ catalog, language }) {
  const photos = catalog.barbers.filter(barber => profileAvailable(barber, catalog, language)).flatMap(barber => barber.portfolio.map(photo => ({ ...photo, barber }))).slice(0, 6);
  if (!photos.length) return null;
  return <section className={styles.portfolio} aria-labelledby="gallery-title"><span className={styles.eyebrow}>DEMETERS / PORTFOLIO</span><h2 id="gallery-title">{language === 'en' ? 'From the chair.' : 'A székből. Válogatás.'}</h2><div>{photos.map((photo, index) => <figure key={`${photo.barber.id}-${index}`}><PublicImage src={photo.src} alt={language === 'en' ? photo.altEn || '' : photo.alt} sizes="(max-width: 700px) 90vw, 45vw" /><figcaption><Link href={profilePath(photo.barber.slug, language)}>{photo.barber.name} ↗</Link></figcaption></figure>)}</div></section>;
}
