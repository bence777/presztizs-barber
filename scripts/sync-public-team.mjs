// Preview by default. Apply with:
// node --experimental-default-type=module --env-file=.env.local scripts/sync-public-team.mjs --apply --weekday-hours
// Adds staff profiles; --weekday-hours assigns the approved Mon–Fri 09:00–17:00 schedule.
// Never reassigns legacy bookings or creates Auth accounts.
import { TEAM, matchTeamMember } from '../data/team.mjs';
import { bookingDb } from '../lib/server/bookingDb.js';

const apply = process.argv.includes('--apply');
const weekdayHours = process.argv.includes('--weekday-hours');
const existingHours = await bookingDb('booking_hours', { query: { select: 'staff_id,weekday,opens,closes' } });
const existing = await bookingDb('booking_staff', { query: { select: 'id,name,active,role,sort_order', order: 'sort_order.asc,name.asc' } });
const planned = TEAM.flatMap((member, index) => {
  const byId = existing.find(staff => staff.id === member.id);
  const byName = matchTeamMember(existing, member.name);
  if (byId && byName?.id !== byId.id) throw new Error(`Az azonosító más személyhez tartozik: ${member.id}`);
  if (byId || byName) return [];
  return [{ ...member, role: 'Barber', active: true, sort_order: index + 1 }];
});
const hoursToAdd = weekdayHours ? TEAM.flatMap(member => {
  const person = existing.find(staff => staff.id === member.id) || matchTeamMember(existing, member.name) || member;
  const hours = existingHours.filter(row => row.staff_id === person.id);
  if (hours.some(row => ![1,2,3,4,5].includes(row.weekday) || row.opens.slice(0,5) !== '09:00' || row.closes.slice(0,5) !== '17:00')) {
    throw new Error(`Eltérő munkarend, nincs felülírva: ${member.name}`);
  }
  return [1,2,3,4,5].filter(day => !hours.some(row => row.weekday === day)).map(weekday => ({ staff_id: person.id, weekday, opens: '09:00', closes: '17:00' }));
}) : [];
console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', newProfiles: planned, newWorkingHours: hoursToAdd, retainedProfiles: existing.map(({ id, name, active }) => ({ id, name, active })), appointments: 'unchanged', authAccounts: 'unchanged' }, null, 2));
if (apply && planned.length) {
  await bookingDb('booking_staff', { method: 'POST', body: planned, prefer: 'return=minimal' });
}
if (apply && hoursToAdd.length) {
  await bookingDb('booking_hours', { method: 'POST', query: { on_conflict: 'staff_id,weekday,opens,closes' }, body: hoursToAdd, prefer: 'resolution=ignore-duplicates,return=minimal' });
}
if (apply) {
  const staff = await bookingDb('booking_staff', { query: { select: 'id,name,active', order: 'sort_order.asc,name.asc' } });
  for (const member of TEAM) {
    const saved = staff.find(person => person.id === member.id) || matchTeamMember(staff, member.name);
    if (!saved?.active || !matchTeamMember([saved], member.name)) throw new Error(`Nincs megfelelő aktív profil: ${member.name}`);
  }
  if (weekdayHours) {
    const hours = await bookingDb('booking_hours', { query: { select: 'staff_id,weekday,opens,closes' } });
    for (const member of TEAM) {
      const person = staff.find(row => row.id === member.id) || matchTeamMember(staff, member.name);
      for (const day of [1,2,3,4,5]) if (!hours.some(row => row.staff_id === person.id && row.weekday === day && row.opens.slice(0,5) === '09:00' && row.closes.slice(0,5) === '17:00')) throw new Error(`Hiányzó munkaidő: ${member.name}, ${day}`);
    }
  }
  console.log(`Verified: ${TEAM.length} active team profiles${weekdayHours ? ' with Mon–Fri 09:00–17:00 hours' : ''}; legacy appointments and hours were not modified.`);
}
