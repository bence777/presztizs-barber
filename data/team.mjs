export const TEAM = [
  { name: 'Paliga Zoltán' },
  { name: 'Kovács Tibi' },
  { name: 'Nehéz Zsíros Bence' },
  { name: 'Tóth Dominik' },
  { name: 'Hunyadi Róbert' },
  { name: 'Pelles Zsombor' },
];

const normalizeName = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').replace(/\s+/g, ' ').trim();
export const matchTeamMember = (barbers, name) => name ? barbers.find(barber => normalizeName(barber.name) === normalizeName(name)) : undefined;
