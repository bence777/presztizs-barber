import Link from 'next/link';
import { bookingHref, profilePath, route } from '../data/site.mjs';
import { COPY } from '../data/seoContent.mjs';
import { profileAvailable, priceRange, serviceName } from '../lib/seo/catalog.mjs';
import PublicImage from './PublicImage';
import s from '../styles/InnerPages.module.css';

export default function BarberDirectory({ catalog, language = 'hu', barbers = catalog.barbers }) {
  const c = COPY[language], en = language === 'en';
  return <section id="barber-directory" className={s.directory} aria-label={c.team}>
    <div className={s.directoryHeading}><span className={s.kicker}>{en ? 'FIND YOUR BARBER' : 'TALÁLD MEG A FODRÁSZOD'}</span><p>{en ? 'A name. A style. Your next appointment.' : 'Egy név. Egy kézjegy. A következő időpontod.'}</p></div>
    {barbers.map((barber, index) => {
      const services = catalog.services.filter(service => service.staffId === barber.id);
      const bio = en ? barber.bioEn : barber.bio;
      return <article key={barber.id} className={s.barberRow}>
        <div className={s.barberIdentity}><span className={s.kicker}>{String(index + 1).padStart(2, '0')} / BARBER</span><h2>{barber.name}</h2>{bio && <p>{bio}</p>}{profileAvailable(barber, catalog, language) && <Link className={s.quietLink} href={profilePath(barber.slug, language)}>{c.profile}</Link>}</div>
        <div className={s.barberVisual}>{barber.image ? <PublicImage src={barber.image} alt={barber.name} sizes="(max-width: 760px) 40vw, 24vw" /> : <span aria-hidden="true">{barber.name.split(' ').map(part => part[0]).join('')}</span>}</div>
        <div className={s.barberMenu}><span className={s.kicker}>{c.services}</span><ul>{services.map(service => <li key={service.id}><Link href={bookingHref(language, barber, service)}>{serviceName(service, language)}</Link><span>{service.duration} {c.duration}</span></li>)}</ul>{services.length > 0 && <p className={s.barberRange}>{priceRange(services, language)}</p>}<Link className={s.solidButton} href={bookingHref(language, barber)}>{c.book}</Link><Link className={s.quietLink} href={`${route('prices', language)}#barber-${barber.id}`}>{c.allPrices}</Link></div>
      </article>;
    })}
  </section>;
}
