import os from 'node:os';
// All API requests use fixtures; these checks never create real bookings or email.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TEAM } from '../data/team.mjs';
const require = createRequire(path.join(process.env.DEMETERS_QA_MODULES || process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const base = process.env.DEMETERS_PREVIEW_URL || 'http://127.0.0.1:3102';
const output = process.env.DEMETERS_QA_OUTPUT || `${os.tmpdir()}/demeters-qa/home-booking`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.DEMETERS_BROWSER ? { executablePath: process.env.DEMETERS_BROWSER } : {}) });
const staff = TEAM.map((member, i) => ({ ...member, id: member.id, active: true }));
const services = staff.map(member => ({ id: 'cut-' + member.id, staffId: member.id, staff_id: member.id, name: 'Hajvágás', duration: 30, price: 6000, duration_minutes: 30, price_huf: 6000, active: true }));
let checks = 0;
const pass = label => { checks++; console.log('PASS ' + label); };
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce', timezoneId: 'Europe/Budapest' });
    const page = await context.newPage(), errors = [], creates = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-16T08:00:00Z') });
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); let result;
      if (url.pathname === '/api/booking/config') result = { barbers: staff, services };
      else if (url.pathname === '/api/booking/availability') result = { hasWorkingHours: true, days: { '2026-11-17': [{ value: '10:00', available: true }] } };
      else if (url.pathname === '/api/guest/session') result = { remembered: true, name: 'Teszt Vendég', maskedEmail: 't***@example.com' };
      else if (url.pathname === '/api/guest/me') result = { profile: { name: 'Teszt Vendég', email: 'test@example.com', phone: '+36301234567' } };
      else if (url.pathname === '/api/booking/create') {
        const data = route.request().postDataJSON(); creates.push(data);
        result = { booking: { id: 'fixture', staff_name: staff[1].name, service_name: 'Hajvágás', local_date: data.date, local_time: data.time, price_huf: 6000 } };
      } else throw new Error('Unexpected API: ' + url.pathname);
      await route.fulfill({ json: result });
    });
    await page.goto(base);
    assert.equal(await page.locator('#foglalas [data-barber-carousel]').count(), 0);
    assert.ok(await page.evaluate(() => scrollY < 10), 'Loading the home page must keep the hero visible');
    assert.equal(await page.locator('h1').count(), 1);
    await page.evaluate(() => { window.homeInstance = 'retained'; });
    await page.locator('header').getByRole('link', { name: 'FOGLALÁS', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/');
    assert.equal(new URL(page.url()).hash, '#foglalas');
    const booking = page.locator('#foglalas');
    await booking.getByRole('heading', { name: 'Válassz fodrászt', exact: true }).waitFor();
    await page.locator('#csapat [aria-roledescription="carousel"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('#csapat article[class*="activeCard"]').getByRole('link', { name: 'IDŐPONTFOGLALÁS', exact: true }).click();
    await booking.getByRole('heading', { name: 'Miben segíthetünk?', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.homeInstance), 'retained', 'Choosing a barber must not reload the page');
    assert.ok((await booking.locator('[class*="summaryRows"]').innerText()).includes(staff[1].name));
    assert.equal(new URL(page.url()).pathname, '/');
    await booking.getByRole('button', { name: /Hajvágás/ }).click();
    await booking.getByRole('button', { name: /2026.*november.*17/ }).click();
    await booking.getByRole('button', { name: '10:00', exact: true }).click();
    await booking.getByRole('button', { name: 'Tovább az adatokhoz', exact: true }).click();
    await booking.getByRole('button', { name: 'IGEN, ÉN VAGYOK', exact: true }).click();
    await booking.getByRole('button', { name: 'Foglalás áttekintése', exact: true }).click();
    assert.equal(creates.length, 0);
    await booking.getByRole('button', { name: 'IDŐPONT VÉGLEGESÍTÉSE', exact: true }).click();
    await booking.getByRole('heading', { name: 'A foglalásod sikeres.', exact: true }).waitFor();
    assert.deepEqual(creates, [{ serviceId: services[1].id, barberId: staff[1].id, date: '2026-11-17', time: '10:00' }]);
    assert.equal(new URL(page.url()).pathname, '/');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/${width}-confirmation.png` });
    pass(`${width}px home: inline booking completes with correct barber, no reload or overflow`);
    await page.locator('#csapat article[class*="activeCard"]').getByRole('link', { name: 'IDŐPONTFOGLALÁS', exact: true }).click();
    await booking.getByRole('heading', { name: 'Miben segíthetünk?', exact: true }).waitFor();
    assert.equal(await booking.getByRole('heading', { name: 'A foglalásod sikeres.', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.homeInstance), 'retained');
    assert.equal(creates.length, 1);
    pass(`${width}px selecting the same team card starts a fresh booking without reloading`);
    await page.goto(base + '/idopontfoglalas?barber=paliga-zoltan&service=cut-paliga-zoltan&lang=en');
    await booking.getByRole('heading', { name: 'Find your day.', exact: true }).waitFor();
    const redirected = new URL(page.url());
    assert.equal(redirected.pathname, '/en'); assert.equal(redirected.hash, '#foglalas');
    assert.equal(redirected.searchParams.get('service'), 'cut-paliga-zoltan');
    assert.equal(redirected.searchParams.get('barber'), 'paliga-zoltan');
    assert.equal(redirected.searchParams.get('lang'), null);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.deepEqual(errors, []);
    pass(`${width}px legacy links retain barber, service and language on the home page`);
    await context.close();
  }
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Europe/Budapest' });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-11-16T08:00:00Z') });
    const manager = { role: 'owner', staff_id: null };
    const bookings = ['confirmed', 'completed'].flatMap((status, day) => [59, 60, 90].map((duration, i) => {
      const start = new Date(`2026-11-${16 + day}T${10 + i * 2}:00:00Z`);
      return { id: status + duration, staff_id: staff[0].id, service_id: services[0].id, starts_at: start.toISOString(), ends_at: new Date(+start + duration * 60000).toISOString(), guest_name: `${status} ${duration}`, service_name: 'Hajvágás', staff_name: staff[0].name, status };
    }));
    await page.route('**/api/admin/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1);
      const result = name === 'session' ? { authenticated: true, manager } : name === 'options' ? { manager, staff, services } : name === 'statistics' ? { statistics: { total: 6, haircuts: 3, today: 3 } } : { bookings, timeOff: [{ id: 'break', staff_id: staff[0].id, kind: 'break', starts_at: '2026-11-16T16:00Z', ends_at: '2026-11-16T16:30Z' }], hours: staff.flatMap(s => Array.from({ length: 7 }, (_, weekday) => ({ staff_id: s.id, weekday, opens: '09:00', closes: '18:00' }))) };
      await route.fulfill({ json: result });
    });
    await page.goto(base + '/admin/foglalasok');
    await page.locator('[class*="calendarEvent"]').first().waitFor();
    for (const view of ['Nap', 'Hét', 'Hónap']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      const cards = page.locator(view === 'Hónap' ? '[class*="monthEvent"]' : '[class*="calendarEvent"]');
      const tones = await cards.evaluateAll(elements => elements.map(el => ({ label: el.textContent, color: getComputedStyle(el).backgroundColor })));
      assert.ok(tones.length >= 3);
      for (const card of tones) assert.equal(card.color, / 59/.test(card.label) ? 'rgb(220, 252, 231)' : 'rgb(21, 128, 61)', card.label);
      const breaks = page.locator(view === 'Hónap' ? '[class*="monthBreak"]' : '[class*="breakBlock"]');
      assert.equal(await breaks.first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(254, 226, 226)');
      await page.screenshot({ path: `${output}/${width}-${view}.png` });
      pass(`${width}px ${view}: 59 minutes light green, 60/90 dark green, breaks red`);
    }
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.route('**/api/booking/config', route => route.fulfill({ json: { barbers: staff, services } }));
  await page.goto(base);
  const carousel = page.locator('#csapat');
  await carousel.scrollIntoViewIfNeeded();
  await carousel.locator('article h3').first().waitFor();
  const started = Date.now();
  await carousel.getByRole('button', { name: 'Következő fodrász', exact: true }).click();
  await page.waitForFunction(name => document.querySelector('#csapat article[class*="activeCard"] h3')?.textContent === name && document.querySelector('#csapat [aria-busy]')?.getAttribute('aria-busy') === 'false', staff[1].name);
  assert.ok(Date.now() - started < 900, 'A normal carousel transition should finish in under 900 ms');
  pass('Barber carousel transitions faster than before');
  console.log(`${checks} home-booking checks passed; screenshots: ${output}`);
} finally { await browser.close(); }
