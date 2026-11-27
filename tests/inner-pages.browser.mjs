// Use the opt-in SSR fixture server. No real booking, authentication or email.
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.join(process.env.DEMETERS_QA_MODULES || process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const base = process.env.DEMETERS_PREVIEW_URL || 'http://127.0.0.1:3112';
const browser = await chromium.launch({ headless: true, ...(process.env.DEMETERS_BROWSER ? { executablePath: process.env.DEMETERS_BROWSER } : {}) });
let checks = 0;
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
    await page.route('**/api/**', route => {
      const request = route.request(), url = new URL(request.url());
      assert.equal(request.method(), 'GET', 'This test must never submit a booking');
      if (url.pathname === '/api/booking/config') return route.continue(); // Server uses read-only fixture data.
      if (url.pathname === '/api/booking/availability') return route.fulfill({ json: { hasWorkingHours: true, days: {} } });
      throw new Error('Unexpected API in inner-page test: ' + url.pathname);
    });
    await page.goto(base + '/arak');
    await page.locator('#price-list aside').getByRole('link', { name: /Kovács Tibi/ }).click();
    const group = page.locator('#barber-kovacs-tibi');
    await group.getByRole('heading', { name: 'Kovács Tibi', exact: true }).waitFor();
    await group.getByRole('link', { name: 'Időpontfoglalás: Kovács Tibi, Hajvágás', exact: true }).click();
    await page.getByRole('heading', { name: 'Találjuk meg a napod.', exact: true }).waitFor();
    const selected = new URL(page.url());
    assert.equal(selected.searchParams.get('barber'), 'kovacs-tibi');
    assert.equal(selected.searchParams.get('service'), 'cut-kovacs-tibi');
    console.log(`PASS ${width}px price index and direct service link preserve the selected barber and service`); checks++;
    await page.goto(base + '/en/barbers/paliga-zoltan');
    assert.ok((await page.locator('#personal-services').innerText()).includes('Haircut'));
    await page.getByRole('link', { name: 'Book with me', exact: true }).click();
    await page.getByRole('heading', { name: 'What can we do for you?', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/en');
    assert.equal(new URL(page.url()).searchParams.get('barber'), 'paliga-zoltan');
    console.log(`PASS ${width}px English personal page opens the correct barber’s own services`); checks++;
    await page.goto(base + '/kapcsolat');
    await page.getByRole('link', { name: 'Megnézem a csapatot', exact: true }).click();
    await page.locator('#barber-directory article').first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/fodraszok');
    assert.equal(await page.locator('#barber-directory article').count(), 6);
    assert.equal(await page.locator('main').getByAltText('Demeter Tamás', { exact: true }).count(), 1);
    assert.ok(!/[↗↖↑]/.test(await page.locator('main').innerText()));
    console.log(`PASS ${width}px contact-to-team navigation, founder attribution and arrow-free links`); checks++;
    await page.close();
  }
  console.log(`${checks} inner-page navigation checks passed`);
} finally { await browser.close(); }
