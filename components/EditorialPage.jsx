import { useEffect } from 'react';
import Link from 'next/link';
import { SITE, route, profilePath } from '../data/site.mjs';
import { COPY, SERVICE_CONTENT, pageMetadata, serviceFaq, homeFaq } from '../data/seoContent.mjs';
import { availableServiceKeys, servicesFor, profileAvailable } from '../lib/seo/catalog.mjs';
import { buildSchema } from '../lib/seo/schema.mjs';
import { trackEvent } from '../lib/client/analytics.mjs';
import Seo from './Seo';
import PublicLayout, { ClosingCta } from './PublicLayout';
import InnerPageHero, { BookingNotes, ServiceFacts } from './InnerPageHeroes';
import { ServicePriceList } from './Services';
import BarberDirectory from './BarberDirectory';
import Faq from './Faq';
import LocationSection from './LocationSection';
import PublicImage from './PublicImage';
import styles from '../styles/Editorial.module.css';
import s from '../styles/InnerPages.module.css';

export default function EditorialPage({ pageKey, language, catalog, slug }) {
  const c = COPY[language], en = language === 'en';
  const barber = pageKey === 'profile' ? catalog.barbers.find(member => member.slug === slug) : null;
  const isService = Boolean(SERVICE_CONTENT[pageKey]);
  const meta = pageMetadata(pageKey, language, barber);
  const path = barber ? profilePath(slug, language) : route(pageKey, language);
  const services = barber ? catalog.services.filter(service => service.staffId === barber.id) : isService ? servicesFor(catalog, pageKey) : pageKey === 'prices' ? catalog.services : [];
  const providers = catalog.barbers.filter(member => services.some(service => service.staffId === member.id));
  const otherKeys = availableServiceKeys(catalog).filter(key => key !== pageKey && (!barber || services.some(service => servicesFor(catalog, key).some(item => item.id === service.id))));
  const breadcrumbs = [{ name: c.home, path: route('home', language) }, ...(barber ? [{ name: c.team, path: route('team', language) }] : []), { name: barber?.name || SERVICE_CONTENT[pageKey]?.[language].label || c[pageKey], path }];
  const alternates = barber ? Object.fromEntries(['hu', 'en'].filter(lang => profileAvailable(barber, catalog, lang)).map(lang => [lang === 'hu' ? 'hu-HU' : 'en', profilePath(slug, lang)])) : { 'hu-HU': route(pageKey, 'hu'), en: route(pageKey, 'en') };
  if (alternates['hu-HU']) alternates['x-default'] = alternates['hu-HU'];
  const viewedBarberId = barber?.id;
  useEffect(() => { if (viewedBarberId) trackEvent('barber_profile_viewed', { barber_id: viewedBarberId, language }); }, [viewedBarberId, language]);
  const faqCatalog = barber ? { ...catalog, barbers: [barber], services } : catalog;
  const faq = isService ? serviceFaq(pageKey, catalog, language) : ['prices', 'profile'].includes(pageKey) ? homeFaq(faqCatalog, language).slice(0, 3) : [];
  const hasLocationDetails = Boolean(SITE.address || SITE.phone || SITE.email || SITE.openingHours.length || SITE.mapsUrl || SITE.googleBusinessUrl || SITE.salonPhotos.length);

  return <PublicLayout language={language} catalog={catalog}>
    <Seo {...meta} path={path} language={language} alternates={alternates} image={`/api/og?lang=${language}&page=${pageKey}${barber ? `&barber=${encodeURIComponent(slug)}` : ''}`} schema={buildSchema({ ...meta, path, language, catalog, services, barber, breadcrumbs })} />
    <div className={`${styles.pageWrap} ${s.edition}`} data-page-kind={pageKey}>
      <nav className={styles.breadcrumb} aria-label={en ? 'Breadcrumb' : 'Morzsanavigáció'}>{breadcrumbs.map((item, index) => index < breadcrumbs.length - 1 ? <span key={item.path}><Link href={item.path}>{item.name}</Link><span aria-hidden="true"> / </span></span> : <span key={item.path} aria-current="page">{item.name}</span>)}</nav>
      <InnerPageHero pageKey={pageKey} language={language} catalog={catalog} meta={meta} barber={barber} services={services} />

      {pageKey === 'prices' && <section id="price-list" className={s.priceWorkspace} aria-label={c.allPrices}>
        <aside className={s.priceIndex}><span className={s.kicker}>{en ? 'CHOOSE A BARBER' : 'VÁLASSZ FODRÁSZT'}</span><nav aria-label={c.team}>{providers.map((member, index) => <a key={member.id} href={`#barber-${member.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{member.name}</a>)}</nav><p>{en ? 'Each price belongs to a specific service and barber. Book straight from the list.' : 'Minden ár egy adott szolgáltatáshoz és fodrászhoz tartozik. A listából közvetlenül is foglalhatsz.'}</p></aside>
        <div className={s.priceContent}><div className={s.contentTopline}><span>{en ? 'THE FULL LIST' : 'A TELJES KÍNÁLAT'}</span><span>HUF / {en ? 'MINUTES' : 'PERC'}</span></div><ServicePriceList catalog={catalog} language={language} /></div>
      </section>}

      {pageKey === 'team' && <BarberDirectory catalog={catalog} language={language} />}

      {isService && <>
        <section className={s.serviceStory}><span className={s.kicker}>{en ? 'THE DETAILS' : 'A RÉSZLETEK'}</span><div><h2>{en ? 'A little more\nabout your choice.' : 'Amit a választásodról\nérdemes tudnod.'}</h2><p>{meta.detail}</p></div><div className={s.audience}><span>{en ? 'FOR YOU, IF…' : 'NEKED SZÓL, HA…'}</span><p>{meta.audience}</p></div></section>
        <section id="service-prices" className={s.servicePrices} aria-label={c.services}><div className={s.sectionTitle}><span className={s.kicker}>{en ? 'THE PEOPLE / THE PRICES' : 'FODRÁSZOK / ÁRAK'}</span><h2>{en ? <>Your barber.<br /><em>Your appointment.</em></> : <>A fodrászod.<br /><em>Az időpontod.</em></>}</h2><p>{en ? 'These are the barbers who currently offer this service. Choose directly from their own prices below.' : 'Ezt a szolgáltatást jelenleg az alábbi fodrászoknál foglalhatod. Válassz a saját áraik alapján.'}</p></div><ServicePriceList catalog={catalog} language={language} services={services} /></section>
      </>}

      {pageKey === 'contact' && <>{hasLocationDetails && <LocationSection language={language} full />}<BookingNotes language={language} /></>}

      {barber && <>
        <ServiceFacts services={services} language={language} personal />
        {(en ? barber.specializationsEn : barber.specializations).length > 0 && <section className={s.profileFocus}><span className={s.kicker}>FOCUS / {barber.name}</span><h2>{c.specializations}</h2><ul>{(en ? barber.specializationsEn : barber.specializations).map(item => <li key={item}>{item}</li>)}</ul></section>}
        <section id="personal-services" className={s.personalServices}><div className={s.sectionTitle}><span className={s.kicker}>DEMETERS / {barber.name}</span><h2>{en ? <>My services.<br /><em>Your choice.</em></> : <>A szolgáltatásaim.<br /><em>A te választásod.</em></>}</h2></div><ServicePriceList catalog={catalog} language={language} services={services} groupByBarber={false} /></section>
        {barber.portfolio.length > 0 && <section className={s.personalPortfolio}><div className={s.sectionTitle}><span className={s.kicker}>{barber.name} / PORTFOLIO</span><h2>{c.portfolio}</h2></div><div className={s.workGrid}>{barber.portfolio.map((photo, index) => <figure key={photo.src}><div><PublicImage src={photo.src} alt={en ? photo.altEn || '' : photo.alt} sizes="(max-width: 760px) 90vw, 45vw" /></div><figcaption><span>{String(index + 1).padStart(2, '0')}</span>{en ? photo.altEn : photo.alt}</figcaption></figure>)}</div></section>}
        {Object.keys(barber.socialLinks).length > 0 && <nav className={s.profileSocial} aria-label={c.social}><span className={s.kicker}>{c.social}</span>{Object.entries(barber.socialLinks).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer">{name}</a>)}</nav>}
      </>}

      <div className={s.faqEdition}><Faq items={faq} title={c.faq} /></div>
      {otherKeys.length > 0 && pageKey !== 'contact' && <section className={s.relatedEdition}><span className={s.kicker}>{c.related}</span><nav>{otherKeys.map((key, index) => <Link key={key} href={route(key, language)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{SERVICE_CONTENT[key][language].label}</strong><small>{en ? 'Explore' : 'Megnézem'}</small></Link>)}</nav></section>}
    </div>
    <ClosingCta language={language} barber={barber} pageKey={pageKey} />
  </PublicLayout>;
}
