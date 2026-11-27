import { BookingDbError } from './bookingDb.js';
const fail = message => { throw new BookingDbError(400, 'invalid_public_profile', message); };
const text = (value, max) => { if (typeof value !== 'string' || value.length > max) fail('Túl hosszú vagy hibás profilszöveg.'); return value.trim(); };
export function publicImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return false;
  if (/^\/images\/[a-z0-9_./-]+$/i.test(value) && !value.includes('..')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !/^(localhost|.*\.localhost|.*\.local|.*\.internal|\[.*\]|\d+([.]\d+)*)$/i.test(url.hostname) && !/\s/.test(value);
  } catch { return false; }
}
export function validatePublicProfile(payload) {
  const result = {};
  if (payload.public_slug !== undefined) {
    if (typeof payload.public_slug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(payload.public_slug)) fail('A slug 2–61 kisbetű, szám és kötőjel lehet.');
    result.public_slug = payload.public_slug;
  }
  for (const field of ['bio', 'bio_en']) if (payload[field] !== undefined) result[field] = text(payload[field], 3000);
  for (const field of ['specializations', 'specializations_en']) if (payload[field] !== undefined) {
    if (!Array.isArray(payload[field]) || payload[field].length > 12) fail('Legfeljebb 12 specializáció adható meg.');
    result[field] = [...new Set(payload[field].map(value => text(value, 100)).filter(Boolean))];
  }
  if (payload.portfolio !== undefined) {
    if (!Array.isArray(payload.portfolio) || payload.portfolio.length > 24) fail('Legfeljebb 24 portfóliókép adható meg.');
    result.portfolio = payload.portfolio.map(photo => {
      if (!photo || !publicImageUrl(photo.src)) fail('A portfólióhoz érvényes HTTPS-kép vagy /images/ útvonal szükséges.');
      return { src: photo.src, alt: text(photo.alt || '', 200), altEn: text(photo.altEn || '', 200) };
    });
  }
  if (payload.social_links !== undefined) {
    if (!payload.social_links || typeof payload.social_links !== 'object' || Array.isArray(payload.social_links)) fail('Hibás közösségi profilok.');
    const hosts = { instagram: ['instagram.com', 'www.instagram.com'], facebook: ['facebook.com', 'www.facebook.com'], tiktok: ['tiktok.com', 'www.tiktok.com'] };
    result.social_links = {};
    for (const [key, value] of Object.entries(payload.social_links)) {
      if (!Object.hasOwn(hosts, key)) fail('Nem támogatott közösségi profil.');
      if (!value) continue;
      let url; try { url = new URL(value); } catch { fail('Hibás közösségi hivatkozás.'); }
      if (String(value).length > 500 || url.protocol !== 'https:' || !hosts[key].includes(url.hostname) || url.username || url.password || url.port) fail('A közösségi profilhoz a szolgáltató HTTPS-címét add meg.');
      result.social_links[key] = url.href;
    }
  }
  return result;
}
