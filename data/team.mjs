export const TEAM = [
  { id: 'paliga-zoltan', name: 'Paliga Zoltán' },
  { id: 'kovacs-tibi', name: 'Kovács Tibi' },
  { id: 'nehez-zsiros-bence', name: 'Nehéz Zsíros Bence' },
  { id: 'toth-dominik', name: 'Tóth Dominik' },
  { id: 'hunyadi-robert', name: 'Hunyadi Róbert' },
  { id: 'pelles-zsombor', name: 'Pelles Zsombor' },
];

const normalizeName = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').replace(/\s+/g, ' ').trim();
export const matchTeamMember = (barbers, name) => name ? barbers.find(barber => normalizeName(barber.name) === normalizeName(name)) : undefined;

// Keep the website, booking catalog and "any barber" availability in the same order.
// Existing database IDs are retained when a named barber already has a profile.
export function getTeamBarbers(barbers, { includeMissing = false } = {}) {
  return TEAM.flatMap(member => {
    const profile = barbers.find(barber => barber.id === member.id) || matchTeamMember(barbers, member.name);
    if (profile?.active === false) return [];
    if (!profile && !includeMissing) return [];
    return [{ ...member, ...profile, name: profile?.name || member.name }];
  });
}

export function barberBookingHref(barber) {
  const query = new URLSearchParams({ barber: barber.id, barberName: barber.name });
  return `/idopontfoglalas?${query}`;
}

export function resolveBarberSelection(barbers, query) {
  const id = typeof query.barber === 'string' ? query.barber : null;
  const name = typeof query.barberName === 'string' ? query.barberName : null;
  if (id === 'any' && barbers.length) return { id: 'any' };
  return barbers.find(barber => barber.id === id) || matchTeamMember(barbers, name);
}
