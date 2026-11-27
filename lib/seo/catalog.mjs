import { translate } from '../client/translations.mjs';
import { SERVICE_KEYS } from '../../data/site.mjs';

export function serviceCategory(service) {
  const name = String(service.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/festes|colou?r|dye/.test(name)) return null;
  const hair = /haj|hair/.test(name);
  const beard = /szakall|beard/.test(name);
  if (hair && beard) return 'combo';
  if (/\bfade\b/.test(name)) return 'fade';
  if (beard) return 'beard';
  if (/hajvagas|haircut|hair cut/.test(name)) return 'haircut';
  return null;
}
export const servicesFor = (catalog, key) => catalog.services.filter(service => serviceCategory(service) === key);
export const availableServiceKeys = catalog => SERVICE_KEYS.filter(key => servicesFor(catalog, key).length);
export const hasPublicProfile = (barber, catalog) => Boolean(barber?.slug && barber.bio?.trim().length >= 40 && catalog.services.some(service => service.staffId === barber.id));
export const hasEnglishProfile = (barber, catalog) => hasPublicProfile(barber, catalog) && barber.bioEn?.trim().length >= 40;
export const profileAvailable = (barber, catalog, language = 'hu') => language === 'en' ? hasEnglishProfile(barber, catalog) : hasPublicProfile(barber, catalog);
export function priceRange(services, language = 'hu') {
  if (!services.length) return '';
  const prices = services.map(service => service.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const format = value => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'hu-HU').format(value);
  return `${format(min)}${max !== min ? `–${format(max)}` : ''} Ft`;
}
export const serviceName = (service, language) => language === 'en' ? service.nameEn || translate(service.name, 'en') : service.name;
export const serviceDescription = (service, language) => language === 'en' ? service.descriptionEn || '' : service.description;

export function publicPaths(catalog) {
  return ['home', 'prices', 'team', 'contact', ...availableServiceKeys(catalog)].flatMap(key => [{ key, language: 'hu' }, { key, language: 'en' }]).concat(
    catalog.barbers.flatMap(barber => ['hu', 'en'].filter(language => profileAvailable(barber, catalog, language)).map(language => ({ key: 'profile', language, slug: barber.slug, updatedAt: barber.updatedAt })))
  );
}
