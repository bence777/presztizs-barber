import Link from 'next/link';
import { useLanguage } from './LanguageProvider';
import { bookingHref, profilePath, route } from '../data/site.mjs';
import { COPY, SERVICE_CONTENT } from '../data/seoContent.mjs';
import { availableServiceKeys, servicesFor, priceRange, profileAvailable, serviceName, serviceDescription, serviceCategory } from '../lib/seo/catalog.mjs';
import styles from '../styles/Editorial.module.css';

export function ServicePriceList({ catalog, language = 'hu', services = catalog.services, groupByBarber = true }) {
  const c = COPY[language];
  const barbers = catalog.barbers.filter(barber => services.some(service => service.staffId === barber.id));
  if (!services.length) return <p className={styles.notice}>{c.empty}</p>;
  return <div className={styles.priceList} data-price-list>{barbers.map(barber => <section key={barber.id} id={`barber-${barber.id}`} className={styles.priceGroup} data-price-group>
    {groupByBarber && <div className={styles.priceGroupHeading} data-price-heading><h2>{profileAvailable(barber, catalog, language) ? <Link href={profilePath(barber.slug, language)}>{barber.name}</Link> : barber.name}</h2><span>DEMETERS / DEBRECEN</span></div>}
    {services.filter(service => service.staffId === barber.id).map(service => <article key={service.id} className={styles.priceRow} data-price-row>
      <div><h3>{serviceName(service, language)}</h3>{language === 'en' && serviceName(service, language) === service.name && <small lang="hu">{language === 'en' ? 'Service name as listed by your barber' : ''}</small>}{serviceDescription(service, language) && <p>{serviceDescription(service, language)}</p>}{serviceCategory(service) && <Link className={styles.serviceLink} href={route(serviceCategory(service), language)}>{SERVICE_CONTENT[serviceCategory(service)][language].label}</Link>}</div>
      <div className={styles.priceMeta}><strong>{priceRange([service], language)}</strong><span>{service.duration} {c.duration}</span></div>
      <Link className={styles.bookLink} href={bookingHref(language, barber, service)} aria-label={`${c.book}: ${barber.name}, ${serviceName(service, language)}`}>{c.book}</Link>
    </article>)}
  </section>)}</div>;
}

export default function Services({ catalog, unavailable = false }) {
  const { language } = useLanguage();
  const c = COPY[language];
  const keys = availableServiceKeys(catalog);
  const custom = catalog.services.filter(service => !serviceCategory(service));
  return <section className={styles.services} id="szolgaltatasok" aria-labelledby="services-title">
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>DEMETERS / MENU</span><h2 id="services-title">{language === 'en' ? <>The cut.<br /><em>The details.</em></> : <>A vágás.<br /><em>A részletek.</em></>}</h2></div><div><p>{c.priceNote}</p><Link className={styles.textLink} href={route('prices', language)}>{c.allPrices}</Link></div></div>
    {unavailable ? <p role="status">{c.unavailable}</p> : <div className={styles.serviceMenu}>{keys.map((key, index) => <article key={key}><span className={styles.menuIndex}>{String(index + 1).padStart(2, '0')}</span><Link href={route(key, language)}><h3>{SERVICE_CONTENT[key][language].label}</h3><span>{language === 'en' ? 'Details & booking' : 'Részletek és foglalás'}</span></Link><strong>{priceRange(servicesFor(catalog, key), language)}</strong></article>)}{custom.length > 0 && <article><span className={styles.menuIndex}>+</span><Link href={route('prices', language)}><h3>{language === 'en' ? 'Individual services' : 'Egyedi szolgáltatások'}</h3><span>{c.allPrices}</span></Link><strong>{priceRange(custom, language)}</strong></article>}{!keys.length && !custom.length && <p>{c.empty}</p>}</div>}
  </section>;
}
