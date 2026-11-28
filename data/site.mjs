// Production domain confirmed by the salon owner on 2026-11-27.
// Keep unknown business facts empty; never reuse private staff/account contacts.
export const SITE = Object.freeze({
  origin: 'https://demeters.hu',
  name: 'DEMETERS',
  city: 'Debrecen',
  address: {streetAddress:'Csapó utca 13.',postalCode:'',addressLocality:'Debrecen',addressCountry:'HU'},
  district: '',
  phone: '',
  email: '',
  geo: null, // { latitude, longitude }
  openingHours: [], // { dayOfWeek: ['Monday'], opens: '09:00', closes: '18:00' }
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Debrecen%2C%20Csap%C3%B3%20utca%2013',
  googleBusinessUrl: '',
  parking: { hu: '', en: '' },
  transit: { hu: '', en: '' },
  socialLinks: [],
  salonPhotos: [], // Actual, approved salon photos only: { src, alt, altEn }
  reviews: [], // Verified quotations only: { quote, quoteEn, author, source, url }
});

export const ROUTES = {
  privacy: { hu: '/adatvedelem', en: '/en/privacy' },
  home: { hu: '/', en: '/en' },
  prices: { hu: '/arak', en: '/en/prices' },
  team: { hu: '/fodraszok', en: '/en/barbers' },
  contact: { hu: '/kapcsolat', en: '/en/contact' },
  haircut: { hu: '/ferfi-hajvagas-debrecen', en: '/en/mens-haircut-debrecen' },
  beard: { hu: '/szakallformazas-debrecen', en: '/en/beard-trim-debrecen' },
  fade: { hu: '/fade-hajvagas-debrecen', en: '/en/fade-haircut-debrecen' },
  combo: { hu: '/haj-es-szakall-debrecen', en: '/en/haircut-and-beard-debrecen' },
};
export const SERVICE_KEYS = ['haircut', 'beard', 'fade', 'combo'];
export const route = (key, language = 'hu') => ROUTES[key][language];
export const profilePath = (slug, language = 'hu') => `${route('team', language)}/${encodeURIComponent(slug)}`;
export const absoluteUrl = path => new URL(path, SITE.origin).href;
export const isPreview = () => Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production');

export function identifyPath(pathname) {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  for (const [key, paths] of Object.entries(ROUTES)) {
    for (const [language, value] of Object.entries(paths)) if (path === value) return { key, language };
  }
  const match = path.match(/^\/(fodraszok|en\/barbers)\/([a-z0-9][a-z0-9-]{1,60})$/);
  if (match) return { key: 'profile', language: match[1] === 'fodraszok' ? 'hu' : 'en', slug: match[2] };
  return null;
}
export function alternatePath(pathname, language) {
  const page = identifyPath(pathname);
  return page ? page.key === 'profile' ? profilePath(page.slug, language) : route(page.key, language) : null;
}
export function bookingHref(language = 'hu', barber, service) {
  const params = new URLSearchParams();
  if (barber) params.set('barber', barber.id);
  if (service) params.set('service', service.id);
  return `${route('home', language)}${params.size ? `?${params}` : ''}#foglalas`;
}
