// SERVER ONLY. Explicit allowlists prevent private email, identity and calendar leakage.
import { publicImageUrl } from './publicProfileValidation.js';
import { bookingDb, bookingConfigured, getBookingConfig } from './bookingDb.js';

const PROFILE_FIELDS = 'id,public_slug,bio,bio_en,specializations,specializations_en,portfolio,social_links,public_updated_at';
export async function getPublicCatalog() {
  if (!bookingConfigured()) throw new Error('Public catalog is not configured');
  const catalog = await getBookingConfig({ fresh: true });
  let profiles = [], translations = [];
  let profilesReady = true;
  try {
    [profiles, translations] = await Promise.all([
      bookingDb('booking_staff', { query: { select: PROFILE_FIELDS, active: 'eq.true' } }),
      bookingDb('booking_services', { query: { select: 'id,name_en,description_en', active: 'eq.true', archived_at: 'is.null' } }),
    ]);
  } catch (error) {
    // Allow deployment before the additive migration. Do not swallow outages/auth errors.
    if (!['42703', 'PGRST204'].includes(error.code)) throw error;
    profilesReady = false;
  }
  const byId = new Map(profiles.map(profile => [profile.id, profile]));
  const serviceById = new Map(translations.map(service => [service.id, service]));
  return {
    profilesReady,
    barbers: catalog.barbers.map(barber => {
      const profile = byId.get(barber.id);
      return {
        id: barber.id, name: barber.name, role: barber.role, image: publicImageUrl(barber.image) ? barber.image : null,
        publicPhone: barber.publicPhone, slug: profile?.public_slug || null,
        bio: profile?.bio || '', bioEn: profile?.bio_en || '',
        specializations: Array.isArray(profile?.specializations) ? profile.specializations.filter(value => typeof value === 'string').slice(0,12) : [],
        specializationsEn: Array.isArray(profile?.specializations_en) ? profile.specializations_en.filter(value => typeof value === 'string').slice(0,12) : [],
        portfolio: Array.isArray(profile?.portfolio) ? profile.portfolio.filter(photo => publicImageUrl(photo?.src)).slice(0,24).map(photo => ({ src: photo.src, alt: typeof photo.alt === 'string' ? photo.alt.slice(0,200) : '', altEn: typeof photo.altEn === 'string' ? photo.altEn.slice(0,200) : '' })) : [],
        socialLinks: Object.fromEntries(Object.entries(profile?.social_links || {}).filter(([key,value]) => ['instagram','facebook','tiktok'].includes(key) && typeof value === 'string' && new RegExp(`^https://(www[.])?${key}[.]com/`, 'i').test(value))),
        updatedAt: profile?.public_updated_at || null,
      };
    }),
    services: catalog.services.map(service => ({ ...service, nameEn: serviceById.get(service.id)?.name_en || '', descriptionEn: serviceById.get(service.id)?.description_en || '' })),
  };
}

export async function getPublicAlias(slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return null;
  try {
    const rows = await bookingDb('booking_staff_slug_history', { query: { select: 'staff_id', slug: `eq.${slug}`, limit: '1' } });
    return rows[0]?.staff_id || null;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error.code)) return null;
    throw error;
  }
}
