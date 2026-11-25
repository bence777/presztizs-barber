// Deterministic public-site checks. Every API is intercepted: no real email or booking is created.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TEAM } from '../data/team.mjs';
const require = createRequire(path.join(process.env.DEMETERS_QA_MODULES || process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const base = process.env.DEMETERS_PREVIEW_URL || 'http://127.0.0.1:3102';
const output = process.env.DEMETERS_QA_OUTPUT || '/private/tmp/demeters-qa/public-booking';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.DEMETERS_BROWSER ? { executablePath: process.env.DEMETERS_BROWSER } : {}) });
let passed = 0;
const pass = name => { passed++; console.log('PASS ' + name); };
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce', timezoneId: 'America/New_York' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-25T09:00:00Z') });
    const barbers = TEAM.map((member, index) => ({ id: `barber-${index}`, name: member.name, role: 'Fodrász', image: null }));
    const services = [{ id: 'hajvagas', name: 'Gépi hajvágás', description: 'Precíz vágás', price: 5500, duration: 30 }];
    let authenticated = false, profileSaved = false, conflict = false, creates = [];
    const profile = { name: 'Test Guest', email: 'guest@example.com', phone: '+36301234567' };
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const body = request.postDataJSON();
      let status = 200, result;
      switch (url.pathname) {
        case '/api/booking/config': result = { services, barbers }; break;
        case '/api/booking/availability':
          assert.equal(url.searchParams.get('service'), 'hajvagas');
          assert.ok(['barber-0', 'barber-1', 'any'].includes(url.searchParams.get('barber')));
          result = { hasWorkingHours: true, days: { '2026-11-26': (conflict ? ['11:00'] : ['10:00', '11:00']).map(value => ({ value, available: true })) } }; break;
        case '/api/guest/session': result = { remembered: authenticated, authenticated }; break;
        case '/api/guest/me': status = authenticated ? 200 : 401; result = authenticated ? { profile } : { error: 'Jelentkezz be e-mailes kóddal.' }; break;
        case '/api/guest/send-code': assert.equal(body.email, profile.email); result = { ok: true }; break;
        case '/api/guest/verify-code':
          assert.equal(body.code, '123456'); authenticated = true; result = { needsProfile: true }; break;
        case '/api/guest/profile':
          assert.equal(body.name, profile.name); assert.equal(body.phone, profile.phone); profileSaved = true; result = { profile }; break;
        case '/api/booking/create':
          assert.ok(profileSaved); creates.push(body);
          if (!conflict) { conflict = true; status = 409; result = { error: 'Ezt az időpontot időközben lefoglalták. Válassz másikat.' }; }
          else result = { booking: { id: 'test-booking', service_name: services[0].name, staff_name: barbers[0].name, local_date: body.date, local_time: body.time, price_huf: 5500 } };
          break;
        case '/api/booking/mine': result = { bookings: [], hasMore: false }; break;
        case '/api/guest/devices': result = { devices: [] }; break;
        default: throw new Error('Unexpected request: ' + url.pathname);
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(result) });
    });
    await page.goto(base);
    await page.getByRole('heading', { name: 'Egy saját hely. Közös szemlélet.' }).waitFor();
    assert.ok((await page.locator('#szalon').innerText()).includes('Demeter Tamás'));
    assert.deepEqual(await page.locator('#csapat article h3').allTextContents(), TEAM.map(member => member.name));
    assert.equal(await page.locator('#szolgaltatasok').count(), 0);
    assert.ok(!/5500|Minden vágásnak karaktere van/i.test(await page.locator('main').innerText()));
    assert.ok((await page.locator('video').evaluate(element => getComputedStyle(element).filter)).includes('brightness(0.85)'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/home-${width}.png` });
    pass(`${width}px home: founder, six names, brighter hero, no price list or slogan, no overflow`);

    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('heading', { name: 'Our own space. A shared vision.' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Our own space. A shared vision.' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.locator('header').getByRole('link', { name: 'BOOK', exact: true }).click();
    await page.getByRole('heading', { name: 'Who would you like to see?' }).waitFor();
    assert.equal(await page.locator('[class*="serviceRow"]').count(), 0);
    assert.ok(!/5[\s,]?500/.test(await page.locator('main').innerText()));
    const steps = page.getByRole('navigation', { name: width <= 800 ? 'Mobile booking steps' : 'Booking steps', exact: true });
    assert.deepEqual(await steps.getByRole('button').allTextContents(), ['01Barber', '02Service', '03Appointment', '04Your details']);
    assert.equal(await steps.getByRole('button').nth(1).isDisabled(), true);
    assert.equal(await steps.getByRole('button').nth(2).isDisabled(), true);
    await page.locator('[data-barber-carousel] [aria-roledescription="carousel"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('[data-barber-carousel] article[class*="activeCard"]').getByRole('button', { name: 'BOOK AN APPOINTMENT', exact: true }).click();
    await page.getByRole('heading', { name: 'What can we do for you?' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Clipper haircut/ }).count(), 1);
    await page.screenshot({ path: `${output}/services-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /Clipper haircut/ }).click();
    await page.getByRole('heading', { name: 'Find your day.' }).waitFor();
    await page.getByRole('button', { name: /Thursday, 26 November 2026/ }).click();
    await page.getByRole('button', { name: '10:00', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to your details' }).click();
    await page.getByRole('heading', { name: 'All you need is your email.' }).waitFor();
    assert.equal(creates.length, 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    pass(`${width}px English persists across reload/navigation; barber precedes prices, calendar and identity`);

    if (width === 375) {
      await page.getByLabel('EMAIL ADDRESS', { exact: true }).fill(profile.email);
      await page.getByRole('button', { name: 'SEND VERIFICATION CODE', exact: true }).click();
      await page.getByPlaceholder('Verification code').fill('123456');
      await page.getByRole('button', { name: 'VERIFY EMAIL', exact: true }).click();
      await page.getByLabel('FULL NAME', { exact: true }).fill(profile.name);
      await page.getByLabel('PHONE NUMBER', { exact: true }).fill(profile.phone);
      await page.getByRole('button', { name: 'SAVE DETAILS', exact: true }).click();
      await page.getByRole('button', { name: 'Review booking', exact: true }).click();
      assert.equal(creates.length, 0);
      await page.getByRole('button', { name: 'CONFIRM APPOINTMENT', exact: true }).click();
      await page.getByRole('heading', { name: 'Find your day.' }).waitFor();
      await page.getByRole('button', { name: /Thursday, 26 November 2026/ }).click();
      await page.getByRole('button', { name: '11:00', exact: true }).click();
      await page.getByRole('button', { name: 'Continue to your details' }).click();
      await page.getByRole('button', { name: 'Review booking', exact: true }).click();
      await page.getByRole('button', { name: 'CONFIRM APPOINTMENT', exact: true }).click();
      await page.getByRole('heading', { name: 'Your booking is confirmed.' }).waitFor();
      assert.deepEqual(creates, [
        { serviceId: 'hajvagas', barberId: 'barber-0', date: '2026-11-26', time: '10:00' },
        { serviceId: 'hajvagas', barberId: 'barber-0', date: '2026-11-26', time: '11:00' },
      ]);
      assert.ok((await page.getByRole('status').innerText()).includes('Clipper haircut'));
      await page.screenshot({ path: `${output}/confirmation-mobile.png`, fullPage: true });
      pass('English OTP/profile/review/confirmation completes with the chosen barber; conflict refreshes stale slots');
      await page.getByRole('link', { name: 'Manage my bookings', exact: true }).click();
      await page.getByRole('heading', { name: 'No bookings here.' }).waitFor();
      await page.getByRole('button', { name: 'Magyar', exact: true }).click();
      await page.getByRole('heading', { name: 'Nincs itt foglalás.' }).waitFor();
      pass('booking management works in English and switches back to Hungarian');
    }

    await page.goto(base + '/idopontfoglalas?barberName=Paliga%20Zolt%C3%A1n&lang=en');
    await page.getByRole('heading', { name: 'What can we do for you?' }).waitFor();
    await page.getByRole('button', { name: /Clipper haircut/ }).click();
    await steps.getByRole('button').first().click();
    await page.locator('[data-barber-carousel] [aria-roledescription="carousel"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('[data-barber-carousel] article[class*="activeCard"]').getByRole('button', { name: 'BOOK AN APPOINTMENT', exact: true }).click();
    assert.ok((await page.locator('[class*="summaryBottom"]').innerText()).includes('— Ft'));
    assert.equal(await page.getByRole('button', { name: 'Change service', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Change appointment', exact: true }).count(), 0);
    pass(`${width}px team links preselect the matching live barber; changing barber clears dependent choices`);
    await page.goto(base + '/idopontfoglalas?service=hajvagas&lang=en');
    await page.getByRole('heading', { name: 'Who would you like to see?' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Change service', exact: true }).count(), 0);
    await page.goto(base + '/idopontfoglalas?barberName=Unknown&lang=en');
    await page.getByRole('status').filter({ hasText: 'This barber is not currently available' }).waitFor();
    assert.equal(await page.locator('[class*="serviceRow"]').count(), 0);
    await page.goto(base + '/idopontfoglalas?service=hajvagas&barber=barber-0&lang=hu');
    await page.getByRole('heading', { name: 'Találjuk meg a napod.' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    pass(`${width}px direct links preserve valid selections and do not bypass barber selection; no JavaScript errors`);
    await context.close();
  }
  console.log(`${passed} public-site browser checks passed; screenshots: ${output}`);
} finally { await browser.close(); }
