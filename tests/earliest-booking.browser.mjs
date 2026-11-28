import os from 'node:os';
// Deterministic UI fixtures; no real booking or email is created.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TEAM } from '../data/team.mjs';
const require = createRequire(path.join(process.env.DEMETERS_QA_MODULES || process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const base = process.env.DEMETERS_PREVIEW_URL || 'http://127.0.0.1:3102';
const output = `${os.tmpdir()}/demeters-qa/earliest-carousel`; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.DEMETERS_BROWSER ? { executablePath: process.env.DEMETERS_BROWSER } : {}) });
let passed = 0; const pass = text => { passed++; console.log('PASS ' + text); };
const staff = TEAM.map((member, index) => ({ id: `actual-${index}`, name: member.name, role: 'Barber', image: null }));
const services = [{ id: 'haircut', staffId:staff[3].id, name: 'Hajvágás', duration: 30, price: 6000 }];
const profile = { name: 'Test Guest', email: 'guest@example.com', phone: '+36301234567' };
async function settled(page, name, scope = '#foglalas') {
  await page.waitForFunction(({ name, scope }) => document.querySelector(scope + ' [data-barber-carousel] article[class*="activeCard"] h3')?.textContent === name && document.querySelector(scope + ' [data-barber-carousel] [aria-busy]')?.getAttribute('aria-busy') === 'false', { name, scope });
}
async function cardMetrics(page, scope = '#foglalas') {
  return page.locator(scope + ' [data-barber-carousel] article[class*="activeCard"]').evaluate(card => {
    const cs = getComputedStyle(card), h3 = getComputedStyle(card.querySelector('h3')), button = getComputedStyle(card.querySelector('[class*="cardAction"]'));
    return { width: cs.width, height: cs.height, background: cs.backgroundColor, sectionBackground: getComputedStyle(card.closest('[data-barber-carousel]')).backgroundColor, font: h3.fontFamily, size: h3.fontSize, filter: cs.filter, actionColor: button.color, actionSize: button.fontSize };
  });
}
try {
 for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference', hasTouch: true });
  const page = await context.newPage(), errors = [], creates = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-11-25T08:00:00Z') });
  let earliestCalls = 0, mode = 'success';
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()); let result, status = 200;
    if (url.pathname === '/api/booking/config') result = { barbers: staff, services };
    else if (url.pathname === '/api/booking/earliest') {
      earliestCalls++;
      await new Promise(resolve => setTimeout(resolve, mode === 'delayed' ? 800 : 120));
      result = { appointment: mode === 'none' ? null : { serviceId:'haircut',barberId: staff[3].id, barberName:staff[3].name, date: '2026-12-01', time: earliestCalls === 1 ? '09:00' : '09:30' } };
    } else if (url.pathname === '/api/booking/availability') {
      assert.notEqual(url.searchParams.get('barber'), 'any');
      result = { hasWorkingHours: true, days: { '2026-12-01': [{ value: '09:00', available: true }, { value: '09:30', available: true }] } };
    } else if (url.pathname === '/api/guest/session') result = { remembered: true, name: profile.name, maskedEmail: 'g***@example.com' };
    else if (url.pathname === '/api/guest/me') result = { profile };
    else if (url.pathname === '/api/booking/create') {
      const data = request.postDataJSON(); creates.push(data);
      if (creates.length === 1) { status = 409; result = { error: 'Ezt az időpontot időközben lefoglalták. Válassz másikat.' }; }
      else result = { booking: { id: 'fixture-confirmation', staff_name: staff[3].name, service_name: 'Hajvágás', local_date: data.date, local_time: data.time, price_huf: 6000 } };
    } else throw new Error('Unexpected API request: ' + url.pathname);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(base); await settled(page, staff[0].name, '#csapat');
  const homeMetrics = await cardMetrics(page, '#csapat');
  await page.goto(base + '/idopontfoglalas'); await settled(page, 'Leghamarabbi időpont');
  const bookingMetrics=await cardMetrics(page);assert.equal(bookingMetrics.font,homeMetrics.font);assert.equal(bookingMetrics.background,homeMetrics.background);assert.ok(parseFloat(bookingMetrics.height)<=parseFloat(homeMetrics.height));
  assert.deepEqual(await page.locator('#foglalas [data-barber-carousel] article h3').allTextContents(), ['Leghamarabbi időpont', ...TEAM.map(person => person.name)]);
  assert.equal(await page.locator('[class*="barberGrid"]').count(), 0);
  assert.equal(await page.getByText('Bárki', { exact: true }).count(), 0);
  const scene = page.locator('#foglalas [data-barber-carousel] [aria-roledescription="carousel"]');
  await scene.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/carousel-${width}.png` });
  if (width === 390) {
    const cdp = await context.newCDPSession(page);
    const button = await page.locator('#foglalas [data-barber-carousel] article[class*="activeCard"]').getByRole('button', { name: 'IDŐPONTFOGLALÁS', exact: true }).boundingBox();
    const x = button.x + button.width * .65, y = button.y + button.height / 2;
    const spacing = await scene.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--card-width')) * .76);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * spacing / 6, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else { await scene.focus(); await page.keyboard.press('ArrowRight'); }
  await settled(page, staff[0].name);
  await page.locator('#foglalas [data-barber-carousel] article[class*="activeCard"]').getByRole('button', { name: 'IDŐPONTFOGLALÁS', exact: true }).click();
  await page.getByRole('heading', { name: 'Miben segíthetünk?', exact: true }).waitFor(); assert.equal(earliestCalls, 0);
  pass(`${width}px booking uses compact cards with the same, typography, actions and keyboard carousel; specific-barber booking stays manual`);

  await page.goto(base + '/idopontfoglalas'); await settled(page, 'Leghamarabbi időpont');
  await page.locator('#foglalas [data-barber-carousel] article[class*="activeCard"]').getByRole('button', { name: 'IDŐPONTFOGLALÁS', exact: true }).click();
  await page.getByRole('button', { name: /Hajvágás/ }).click();
  await page.getByRole('status').filter({ hasText: 'A legkorábbi szabad időpont' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '09:00', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.ok((await page.locator('[class*="summaryRows"]').innerText()).includes(staff[3].name));
  const continueButton = page.getByRole('button', { name: 'Tovább az adatokhoz', exact: true });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Tovább az adatokhoz' && !button.disabled));
  assert.equal(creates.length, 0);
  await page.screenshot({ path: `${output}/automatic-${width}.png`, fullPage: true });
  pass(`${width}px earliest search selects the actual barber, next-month calendar day and first time automatically without creating a booking`);
  await continueButton.click();
  await page.getByRole('button', { name: 'IGEN, ÉN VAGYOK', exact: true }).click();
  await page.getByRole('button', { name: 'Foglalás áttekintése', exact: true }).click();
  await page.getByRole('button', { name: 'IDŐPONT VÉGLEGESÍTÉSE', exact: true }).click();
  await page.getByRole('status').filter({ hasText: `${staff[3].name} ·` }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Tovább az adatokhoz' && !button.disabled));
  assert.equal(await page.getByRole('button', { name: '09:30', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(creates.length, 1);
  await continueButton.click(); await page.getByRole('button', { name: 'Foglalás áttekintése', exact: true }).click();
  await page.getByRole('button', { name: 'IDŐPONT VÉGLEGESÍTÉSE', exact: true }).click();
  await page.getByRole('heading', { name: 'A foglalásod sikeres.', exact: true }).waitFor();
  assert.deepEqual(creates, [
    { serviceId: 'haircut', barberId: staff[3].id, date: '2026-12-01', time: '09:00' },
    { serviceId: 'haircut', barberId: staff[3].id, date: '2026-12-01', time: '09:30' },
  ]);
  pass(`${width}px a booking conflict searches again for the selected personal service; confirmation uses the newly displayed real barber and time`);

  mode = 'none'; await page.goto(base + '/idopontfoglalas?barber=any&service=haircut');
  await page.getByRole('alert').filter({ hasText: 'A következő 60 napban nincs szabad időpont.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Tovább az adatokhoz', exact: true }).isDisabled(), true);
  pass(`${width}px empty availability cannot proceed with a fabricated date or time`);
  mode = 'delayed'; await page.goto(base + '/idopontfoglalas?barber=any&service=haircut');
  await page.getByRole('status').filter({ hasText: 'Megkeressük' }).waitFor();
  await page.getByRole('button', { name: 'Vissza a szolgáltatásokhoz', exact: true }).click();
  await page.waitForTimeout(950);
  await page.getByRole('heading', { name: 'Miben segíthetünk?', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  pass(`${width}px leaving a pending search cancels it; no stale result changes the current step and no JavaScript errors occur`);
  await context.close();
 }
 console.log(`${passed} shared-carousel and earliest-booking checks passed`);
} finally { await browser.close(); }
