import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM, getTeamBarbers, matchTeamMember, barberBookingHref, resolveBarberSelection } from '../data/team.mjs';

test('public team uses the same six names in order and preserves existing database IDs', () => {
  const rows = TEAM.map((member, index) => ({ id: `existing-${index}`, name: member.name, role: 'Barber' })).reverse();
  rows.push({ id: 'barber-1', name: 'Első Barber' });
  const actual = getTeamBarbers(rows);
  assert.deepEqual(actual.map(member => member.name), TEAM.map(member => member.name));
  assert.deepEqual(actual.map(member => member.id), TEAM.map((_, index) => `existing-${index}`));
});

test('missing or inactive profiles never become eligible for anonymous bookings', () => {
  const rows = [{ ...TEAM[0], active: false }, { ...TEAM[1], active: true }, { id: 'legacy', name: 'Második Barber', active: true }];
  assert.deepEqual(getTeamBarbers(rows).map(member => member.id), [TEAM[1].id]);
  assert.equal(getTeamBarbers([], { includeMissing: true }).length, 6);
  assert.equal(getTeamBarbers(rows, { includeMissing: true }).some(member => member.id === TEAM[0].id), false);
});

test('card booking URL preserves both the actual staff ID and the full Hungarian name', () => {
  const barber = { id: 'existing-bence', name: 'Nehéz Zsíros Bence' };
  const url = new URL(barberBookingHref(barber), 'https://test.invalid');
  assert.equal(url.pathname, '/idopontfoglalas');
  assert.equal(url.searchParams.get('barber'), barber.id);
  assert.equal(url.searchParams.get('barberName'), barber.name);
  assert.equal(matchTeamMember([barber], ' nehez   zsiros bence ').id, barber.id);
});

test('deep links resolve actual IDs first, fall back to names and never choose an unrelated barber', () => {
  const barbers = getTeamBarbers(TEAM.map((member, index) => ({ ...member, id: `db-${index}` })));
  assert.equal(resolveBarberSelection(barbers, { barber: 'db-2', barberName: TEAM[0].name }).id, 'db-2');
  assert.equal(resolveBarberSelection(barbers, { barber: 'stale-id', barberName: 'Nehez Zsiros Bence' }).id, 'db-2');
  assert.equal(resolveBarberSelection(barbers, { barber: 'unknown', barberName: 'Unknown' }), undefined);
  assert.equal(resolveBarberSelection([], { barber: 'any' }), undefined);
});
