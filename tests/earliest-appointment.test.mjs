import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM } from '../data/team.mjs';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_for_earliest_tests_only';
const { findEarliestAppointment, localToUtcMs } = await import('../lib/server/bookingDb.js');
const originalFetch = globalThis.fetch;
const first = TEAM[0], second = TEAM[1];
let hours, appointments, timeOff, duration, calls, serviceOwner;
const utc = (day, time) => new Date(localToUtcMs(day, time)).toISOString();

test.beforeEach(() => {
  hours = []; appointments = []; timeOff = []; duration = 30; calls = []; serviceOwner=second.id;
  globalThis.fetch = async raw => {
    const url = new URL(raw), table = url.pathname.split('/').at(-1);
    calls.push(table);
    const rows = {
      booking_services: [{ id: 'haircut', staff_id:serviceOwner, name: 'Hajvágás', duration_minutes: duration, price_huf: 6000 }],
      booking_staff: [{ ...second }, { ...first }],
      booking_hours: hours,
      booking_appointments: appointments,
      booking_time_off: timeOff,
    };
    return { ok: true, status: 200, text: async () => JSON.stringify(rows[table] || []) };
  };
});
test.after(() => { globalThis.fetch = originalFetch; });
const search = now => findEarliestAppointment({ serviceId: 'haircut', now: Date.parse(now) });

test('earliest search uses only the owner of the selected service', async () => {
  hours = [
    { staff_id: first.id, weekday: 3, opens: '12:00', closes: '16:00' },
    { staff_id: second.id, weekday: 3, opens: '09:00', closes: '16:00' },
  ];
  assert.deepEqual(await search('2026-11-25T06:00Z'), { serviceId:'haircut', barberId: second.id, barberName: second.name, date: '2026-11-25', time: '09:00' });
});

test('earliest search respects actual bookings, absences and the two-hour notice', async () => {
  hours = [
    { staff_id: first.id, weekday: 3, opens: '12:00', closes: '16:00' },
    { staff_id: second.id, weekday: 3, opens: '08:00', closes: '16:00' },
  ];
  appointments = [{ staff_id: second.id, starts_at: utc('2026-11-25', '09:00'), ends_at: utc('2026-11-25', '09:30') }];
  timeOff = [{ staff_id: second.id, starts_at: utc('2026-11-25', '09:30'), ends_at: utc('2026-11-25', '10:00') }];
  assert.equal((await search('2026-11-25T06:00Z')).time, '10:00');
});

test('a service must fit completely in the selected barber working hours', async () => {
  duration = 60;
  hours = [
    { staff_id: first.id, weekday: 3, opens: '12:00', closes: '16:00' },
    { staff_id: second.id, weekday: 3, opens: '09:00', closes: '09:30' },
  ];
  assert.equal(await search('2026-11-25T06:00Z'), null);
});

test('search crosses a month boundary and returns a real date in the following month', async () => {
  hours = [{ staff_id: second.id, weekday: 2, opens: '09:00', closes: '17:00' }];
  const result = await search('2026-11-30T16:00Z');
  assert.deepEqual(result, { serviceId:'haircut', barberId: second.id, barberName: second.name, date: '2026-12-01', time: '09:00' });
});

test('year boundaries use Budapest local dates and tied slots use the public team order', async () => {
  serviceOwner=first.id;
  hours = [second, first].map(person => ({ staff_id: person.id, weekday: 5, opens: '09:00', closes: '17:00' }));
  assert.deepEqual(await search('2026-12-31T23:30Z'), { serviceId:'haircut', barberId: first.id, barberName: first.name, date: '2027-01-01', time: '09:00' });
});

test('no availability returns null after checking the entire 60-day booking window', async () => {
  assert.equal(await search('2026-11-25T06:00Z'), null);
  assert.equal(calls.filter(table => table === 'booking_appointments').length, 3);
});
