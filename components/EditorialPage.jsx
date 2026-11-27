import { useEffect } from 'react';
import Link from 'next/link';
import { route, profilePath, bookingHref } from '../data/site.mjs';
import { COPY, SERVICE_CONTENT, pageMetadata, serviceFaq, homeFaq } from '../data/seoContent.mjs';
import { availableServiceKeys, servicesFor, profileAvailable } from '../lib/seo/catalog.mjs';
import { buildSchema } from '../lib/seo/schema.mjs';
import { trackEvent } from '../lib/client/analytics.mjs';
import Seo from './Seo';
import PublicLayout, { ClosingCta } from './PublicLayout';
import { ServicePriceList } from './Services';
import BarberDirectory from './BarberDirectory';
import Faq from './Faq';
import LocationSection from './LocationSection';
import PublicImage from './PublicImage';
import styles from '../styles/Editorial.module.css';

export default function EditorialPage({ pageKey, language, catalog, slug }) {
  const c = COPY[language], en = language === 'en';
  const barber = pageKey === 'profile' ? catalog.barbers.find(member => member.slug === slug) : null;
  const meta = pageMetadata(pageKey, language, barber);
  const path = barber ? profilePath(slug, language) : route(pageKey, language);
  const services = barber ? catalog.services.filter(service => service.staffId === barber.id) : SERVICE_CONTENT[pageKey] ? servicesFor(catalog, pageKey) : pageKey === 'prices' ? catalog.services : [];
  const otherKeys = availableServiceKeys(catalog).filter(key => key !== pageKey && (!barber || services.some(service => servicesFor(catalog, key).some(item => item.id === service.id))));
  const breadcrumbs = [{ name: c.home, path: route('home', language) }, ...(barber ? [{ name: c.team, path: route('team', language) }] : []), { name: barber?.name || SERVICE_CONTENT[pageKey]?.[language].label || c[pageKey], path }];
  const alternates = barber ? Object.fromEntries(['hu', 'en'].filter(lang => profileAvailable(barber, catalog, lang)).map(lang => [lang === 'hu' ? 'hu-HU' : 'en', profilePath(slug, lang)])) : { 'hu-HU': route(pageKey, 'hu'), en: route(pageKey, 'en') };
  if (alternates['hu-HU']) alternates['x-default'] = alternates['hu-HU'];
  const viewedBarberId = barber?.id;
  useEffect(() => { if (viewedBarberId) trackEvent('barber_profile_viewed', { barber_id: viewedBarberId, language }); }, [viewedBarberId, language]);
  const faq = SERVICE_CONTENT[pageKey] ? serviceFaq(pageKey, catalog, language) : ['prices', 'profile'].includes(pageKey) ? homeFaq(catalog, language).slice(0, 3) : [];
  return <PublicLayout language={language} catalog={catalog}>
    <Seo {...meta} path={path} language={language} alternates={alternates} image={`/api/og?lang=${language}&page=${pageKey}${barber ? `&barber=${encodeURIComponent(slug)}` : ''}`} schema={buildSchema({ ...meta, path, language, catalog, services, barber, breadcrumbs })} />
    <div className={styles.pageWrap}>
      <nav className={styles.breadcrumb} aria-label={en ? 'Breadcrumb' : 'Morzsanavigáció'}>{breadcrumbs.map((item, index) => index < breadcrumbs.length - 1 ? <span key={item.path}><Link href={item.path}>{item.name}</Link><span aria-hidden="true"> / </span></span> : <span key={item.path} aria-current="page">{item.name}</span>)}</nav>
      <section className={`${styles.pageHero} ${barber?.image ? styles.profileHero : ''} ${SERVICE_CONTENT[pageKey] ? styles.serviceHero : ''}`}>
        <div><span className={styles.eyebrow}>DEMETERS / DEBRECEN / {SERVICE_CONTENT[pageKey]?.[language].label || c[pageKey] || 'BARBER'}</span><h1>{meta.h1}</h1><p>{SERVICE_CONTENT[pageKey] ? meta.intro : barber ? en ? barber.bioEn : barber.bio : pageKey === 'team' ? c.teamIntro : pageKey === 'prices' ? c.priceIntro : c.localCopy}</p><Link href={bookingHref(language, barber)} className={styles.button}>{c.book} ↗</Link></div>
        {barber?.image && <figure className={styles.profilePortrait}><PublicImage src={barber.image} alt={barber.name} priority /></figure>}
      </section>
      {SERVICE_CONTENT[pageKey] && <><section className={styles.serviceDetail}><h2>{en ? 'The appointment.' : 'Az időpontod.'}</h2><div><p>{meta.detail}</p><h3>{en ? 'Who is it for?' : 'Kinek ajánljuk?'}</h3><p>{meta.audience}</p></div></section><ServicePriceList catalog={catalog} language={language} services={services} /><div className={styles.teamLink}><Link className={styles.textLink} href={route('team', language)}>{c.team} ↗</Link></div></>}
      {pageKey === 'prices' && <><p className={styles.notice}>{c.priceNote}</p><nav className={styles.jumpNav} aria-label={c.team}>{catalog.barbers.filter(member => services.some(service => service.staffId === member.id)).map(member => <a key={member.id} href={`#barber-${member.id}`}>{member.name} ↓</a>)}</nav><ServicePriceList catalog={catalog} language={language} /></>}
      {pageKey === 'team' && <BarberDirectory catalog={catalog} language={language} />}
      {pageKey === 'contact' && <LocationSection language={language} full />}
      {barber && <>
        {(en ? barber.specializationsEn : barber.specializations).length > 0 && <section className={styles.specializations}><h2>{c.specializations}</h2><ul>{(en ? barber.specializationsEn : barber.specializations).map(item => <li key={item}>{item}</li>)}</ul></section>}
        <ServicePriceList catalog={catalog} language={language} services={services} groupByBarber={false} />
        {barber.portfolio.length > 0 && <section className={styles.portfolio}><h2>{c.portfolio}</h2><div>{barber.portfolio.map(photo => <figure key={photo.src}><PublicImage src={photo.src} alt={en ? photo.altEn || '' : photo.alt} sizes="(max-width: 700px) 90vw, 45vw" />{(en ? photo.altEn : photo.alt) && <figcaption>{en ? photo.altEn : photo.alt}</figcaption>}</figure>)}</div></section>}
        {Object.keys(barber.socialLinks).length > 0 && <nav className={styles.social} aria-label={c.social}>{Object.entries(barber.socialLinks).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer">{name} ↗</a>)}</nav>}
      </>}
      <Faq items={faq} title={c.faq} />
      {otherKeys.length > 0 && <section className={styles.related}><h2>{c.related}</h2><nav>{otherKeys.map(key => <Link key={key} href={route(key, language)}>{SERVICE_CONTENT[key][language].label} ↗</Link>)}</nav></section>}
    </div>
    <ClosingCta language={language} barber={barber} />
  </PublicLayout>;
}
