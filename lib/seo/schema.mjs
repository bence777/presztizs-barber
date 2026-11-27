import { SITE, absoluteUrl, bookingHref, profilePath, route } from '../../data/site.mjs';
import { profileAvailable, serviceName, serviceDescription } from './catalog.mjs';

const salonId = `${SITE.origin}/#salon`;
export const serializeJsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function buildSchema({ path, title, description, language = 'hu', catalog, services = [], barber, breadcrumbs = [] }) {
  const url = absoluteUrl(path);
  const lang = language === 'en' ? 'en' : 'hu-HU';
  const graph = [
    { '@type': 'HairSalon', '@id': salonId, name: SITE.name, url: SITE.origin,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/images/demeters-logo.svg') },
      areaServed: { '@type': 'City', name: SITE.city },
      ...(SITE.phone ? { telephone: SITE.phone } : {}), ...(SITE.email ? { email: SITE.email } : {}),
      ...(SITE.address ? { address: { '@type': 'PostalAddress', ...SITE.address } } : {}),
      ...(SITE.geo ? { geo: { '@type': 'GeoCoordinates', ...SITE.geo } } : {}),
      ...(SITE.openingHours.length ? { openingHoursSpecification: SITE.openingHours.map(hours => ({ '@type': 'OpeningHoursSpecification', ...hours })) } : {}),
      ...(SITE.salonPhotos.length ? { image: SITE.salonPhotos.map(photo => absoluteUrl(photo.src)) } : {}),
      ...(SITE.socialLinks.length ? { sameAs: SITE.socialLinks } : {}),
      ...(SITE.googleBusinessUrl ? { hasMap: SITE.googleBusinessUrl } : {}),
      potentialAction: { '@type': 'ReserveAction', target: absoluteUrl(bookingHref(language)) },
      ...(services.length ? { hasOfferCatalog: { '@id': `${url}#catalog` } } : {}),
    },
    { '@type': 'WebSite', '@id': `${SITE.origin}/#website`, url: SITE.origin, name: SITE.name, inLanguage: ['hu-HU', 'en'], publisher: { '@id': salonId } },
    { '@type': barber ? 'ProfilePage' : 'WebPage', '@id': `${url}#page`, url, name: title, description, inLanguage: lang,
      isPartOf: { '@id': `${SITE.origin}/#website` }, about: { '@id': salonId },
      ...(barber ? { mainEntity: { '@id': `${SITE.origin}/#person-${barber.id}` } } : {}),
      ...(breadcrumbs.length ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
    },
  ];
  const staff = barber ? [barber] : catalog?.barbers.filter(member => services.some(service => service.staffId === member.id)) || [];
  graph.push(...staff.map(member => ({ '@type': 'Person', '@id': `${SITE.origin}/#person-${member.id}`, name: member.name,
    jobTitle: language === 'en' ? 'Barber' : 'Fodrász', worksFor: { '@id': salonId },
    ...(profileAvailable(member, catalog, language) ? { url: absoluteUrl(profilePath(member.slug, language)) } : {}),
    ...(member.image ? { image: absoluteUrl(member.image) } : {}),
    ...((language === 'en' ? member.bioEn : member.bio) ? { description: language === 'en' ? member.bioEn : member.bio } : {}),
    ...(Object.values(member.socialLinks || {}).length ? { sameAs: Object.values(member.socialLinks) } : {}),
  })));
  if (services.length) {
    graph.push({ '@type': 'OfferCatalog', '@id': `${url}#catalog`, name: language === 'en' ? 'Services and prices' : 'Szolgáltatások és árak', inLanguage: lang,
      itemListElement: services.map(service => ({ '@type': 'Offer', '@id': `${SITE.origin}/#offer-${service.id}-${language}`, price: service.price, priceCurrency: 'HUF',
        url: absoluteUrl(bookingHref(language, { id: service.staffId }, service)),
        itemOffered: { '@id': `${SITE.origin}/#service-${service.id}-${language}` }, seller: { '@id': salonId },
      })),
    });
    graph.push(...services.map(service => ({ '@type': 'Service', '@id': `${SITE.origin}/#service-${service.id}-${language}`, name: serviceName(service, language),
      ...(serviceDescription(service, language) ? { description: serviceDescription(service, language) } : {}),
      provider: { '@id': `${SITE.origin}/#person-${service.staffId}` }, areaServed: { '@type': 'City', name: SITE.city },
      offers: { '@id': `${SITE.origin}/#offer-${service.id}-${language}` },
    })));
  }
  if (breadcrumbs.length) graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path) })) });
  return { '@context': 'https://schema.org', '@graph': graph };
}
