import Image from 'next/image';
import Link from 'next/link';
import { SITE, bookingHref, route } from '../data/site.mjs';
import { COPY, SERVICE_CONTENT } from '../data/seoContent.mjs';
import { availableServiceKeys, priceRange, servicesFor } from '../lib/seo/catalog.mjs';
import PublicImage from './PublicImage';
import s from '../styles/InnerPages.module.css';

export function ServiceFacts({ services, language, personal = false }) {
  const en = language === 'en';
  const durations = services.map(service => service.duration);
  const min = Math.min(...durations), max = Math.max(...durations);
  if (!services.length) return null;
  return <dl className={s.facts}>
    <div><dt>{en ? 'Current prices' : 'Aktuális árak'}</dt><dd>{priceRange(services, language)}</dd></div>
    <div><dt>{en ? 'Appointment length' : 'Időtartam'}</dt><dd>{min}{min !== max ? `–${max}` : ''} <small>{en ? 'min' : 'perc'}</small></dd></div>
    <div><dt>{personal ? en ? 'My services' : 'Saját szolgáltatás' : en ? 'Barbers offering this' : 'Választható fodrász'}</dt><dd>{String(personal ? services.length : new Set(services.map(service => service.staffId)).size).padStart(2, '0')}</dd></div>
  </dl>;
}

export default function InnerPageHero({ pageKey, language, catalog, meta, barber, services }) {
  const en = language === 'en', c = COPY[language];
  if (pageKey === 'prices') return <section className={s.pricesHero}>
    <div className={s.pricesHeadline}><span className={s.kicker}>DEMETERS / {en ? 'THE PRICE LIST' : 'ÁRLISTA'}</span><h1>{en ? <>Good cuts.<br /><em>Clear prices.</em></> : <>Jó vágás.<br /><em>Tiszta árak.</em></>}</h1><p>{en ? 'Men’s haircuts in Debrecen. Choose the service. See the price. Make it yours.' : 'Férfi hajvágás Debrecenben. Válassz szolgáltatást, nézd meg az árat, és foglalj a saját fodrászodhoz.'}</p><Link href="#price-list" className={s.solidButton}>{en ? 'Explore the price list' : 'Megnézem az árakat'}</Link></div>
    <div className={s.priceOverview}><span className={s.kicker}>{en ? 'AT A GLANCE' : 'ELSŐ PILLANTÁSRA'}</span>{availableServiceKeys(catalog).map((key, index) => <Link key={key} href={route(key, language)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{SERVICE_CONTENT[key][language].label}</strong><small>{priceRange(servicesFor(catalog, key), language)}</small></div></Link>)}<p>{c.priceNote}</p></div>
  </section>;

  if (pageKey === 'team') return <section className={s.teamHero}>
    <div className={s.teamHeadline}><span className={s.kicker}>DEMETERS / {en ? 'THE PEOPLE' : 'A CSAPAT'}</span><h1>{en ? <>A shared place.<br /><em>Individual style.</em></> : <>Közös hely.<br /><em>Saját kézjegy.</em></>}</h1><p>{c.teamIntro}</p><a href="#barber-directory" className={s.lightButton}>{en ? 'Meet the barbers' : 'Megnézem a csapatot'}</a><div className={s.teamCount}><strong>{String(catalog.barbers.length).padStart(2, '0')}</strong><span>{en ? 'barbers.\nYour choice.' : 'fodrász.\nTe választasz.'}</span></div></div>
    <figure className={s.founderPortrait}><Image src="/images/demetertamas.webp" alt="Demeter Tamás" fill sizes="(max-width: 760px) 90vw, 42vw" priority /><figcaption><span>DEMETER TAMÁS</span><span>{en ? 'Founder / DEMETERS' : 'Alapító / DEMETERS'}</span></figcaption></figure>
  </section>;

  if (pageKey === 'contact') return <section className={s.contactHero}>
    <div className={s.contactHeadline}><span className={s.kicker}>DEMETERS / {en ? 'CONTACT' : 'KAPCSOLAT'}</span><h1>{en ? <>See you<br /><em>in Debrecen.</em></> : <>Találkozzunk<br /><em>Debrecenben.</em></>}</h1><p>{en ? 'Your next appointment starts here. Choose your barber and find a time that works for you.' : 'A következő időpontod itt kezdődik. Válaszd ki a fodrászodat, és találjunk egy helyet a naptáradban.'}</p><Link href={bookingHref(language)} className={s.solidButton}>{c.book}</Link></div>
    <div className={s.cityPoster}><span className={s.kicker}>HAIR / PEOPLE / DEMETERS</span><div aria-hidden="true">DEB<span>RECEN</span></div><address>{SITE.address ? <>{SITE.address.postalCode} {SITE.address.addressLocality}<br />{SITE.address.streetAddress}</> : 'DEMETERS / DEBRECEN'}</address><span className={s.citySignature}>D.</span></div>
  </section>;

  if (barber) return <section className={s.personHero}>
    <div className={s.personHeading}><span className={s.kicker}>DEMETERS / BARBER / DEBRECEN</span><h1>{barber.name}</h1><p>{en ? barber.bioEn : barber.bio}</p><Link href={bookingHref(language, barber)} className={s.solidButton}>{en ? 'Book with me' : 'Hozzám foglalok'}</Link><a className={s.quietLink} href="#personal-services">{en ? 'My services & prices' : 'Szolgáltatásaim és áraim'}</a></div>
    <div className={s.personVisual}>{barber.image ? <PublicImage src={barber.image} alt={barber.name} priority /> : <span className={s.personMonogram} aria-hidden="true">{barber.name.split(' ').map(part => part[0]).join('')}</span>}<span className={s.personSignature}>DEMETERS / {barber.name}</span></div>
  </section>;

  const labels = { haircut: ['01', 'CUT'], combo: ['02', 'DUO'], beard: ['03', 'BEARD'], fade: ['04', 'FADE'] };
  const [number, word] = labels[pageKey];
  return <section className={`${s.serviceHero} ${pageKey === 'combo' ? s.comboHero : ''}`}>
    <div className={s.serviceHeading}><span className={s.kicker}>DEMETERS / {SERVICE_CONTENT[pageKey][language].label} / DEBRECEN</span><h1>{meta.h1}</h1><p>{meta.intro}</p><a className={s.solidButton} href="#service-prices">{en ? 'Choose your barber' : 'Fodrászt választok'}</a></div>
    <div className={s.serviceArtwork} aria-hidden="true"><Image src="/hero-poster.jpg" alt="" fill sizes="(max-width: 760px) 90vw, 40vw" priority /><span className={s.artworkIndex}>{number} / DEMETERS</span><span className={s.artworkWord}>{word}</span><span className={s.artworkFooter}>PRECISION IS PERSONAL.</span></div>
    <ServiceFacts services={services} language={language} />
  </section>;
}

export function BookingNotes({ language }) {
  const en = language === 'en';
  const steps = en ? [['Your barber', 'Explore the team and choose who you would like to book with.', 'Meet the team', 'team'], ['Your service', 'Each barber’s current prices and appointment lengths, in one place.', 'See the prices', 'prices'], ['Your time', 'Choose an available slot, verify your email and confirm your appointment.', 'Book an appointment', 'home']] : [['A fodrászod', 'Ismerd meg a csapatot, és válaszd ki, kihez szeretnél érkezni.', 'Megnézem a csapatot', 'team'], ['A szolgáltatásod', 'Az aktuális árakat és időtartamokat fodrászonként találod meg.', 'Megnézem az árakat', 'prices'], ['Az időpontod', 'Válassz szabad időpontot, azonosítsd magad e-mailben, majd véglegesítsd a foglalást.', 'Időpontot foglalok', 'home']];
  return <section className={s.bookingNotes}><div className={s.notesHeading}><span className={s.kicker}>DEMETERS / {en ? 'YOUR VISIT' : 'A KÖVETKEZŐ LÉPÉS'}</span><h2>{en ? <>A place in<br /><em>your calendar.</em></> : <>Egy hely<br /><em>a naptáradban.</em></>}</h2></div><div className={s.steps}>{steps.map(([title, text, label, key], index) => <article key={key}><span className={s.stepNumber}>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{text}</p><Link href={key === 'home' ? bookingHref(language) : route(key, language)}>{label}</Link></article>)}</div></section>;
}
