// Mocked catalog for UI verification: never creates appointments or sends email.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TEAM } from '../data/team.mjs';
const require = createRequire(path.join(process.env.DEMETERS_QA_MODULES || process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const base = process.env.DEMETERS_PREVIEW_URL || 'http://127.0.0.1:3102';
const output = process.env.DEMETERS_QA_OUTPUT || '/private/tmp/demeters-qa/team-selection';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.DEMETERS_BROWSER ? { executablePath: process.env.DEMETERS_BROWSER } : {}) });
let passed = 0;
const pass = name => { passed++; console.log('PASS ' + name); };
const staff = TEAM.map((member, index) => ({ id: `actual-db-${index}`, name: member.name, role: 'Barber', image: null }));
const services = [{ id: 'hajvagas', name: 'Hajvágás', price: 6000, duration: 30 }];
async function mockCatalog(page) {
  await page.route('**/api/booking/config', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ services, barbers: [{ id: 'legacy', name: 'Első Barber', role: 'Barber' }, ...staff.slice().reverse()] }) }));
}
async function settled(page, index) {
  await page.waitForFunction(name => document.querySelector('#csapat article[class*="activeCard"] h3')?.textContent === name && document.querySelector('#csapat [aria-busy]')?.getAttribute('aria-busy') === 'false', TEAM[index].name);
}
async function showTeam(page) {
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#csapat article a')?.getAttribute('href')?.includes('actual-db-0'));
  await page.evaluate(() => scrollTo({ top: document.getElementById('csapat').getBoundingClientRect().top + scrollY, behavior: 'instant' }));
}
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); await mockCatalog(page);
    await page.goto(base + '/idopontfoglalas');
    await page.getByRole('button', { name: 'Paliga Zoltán Barber', exact: true }).waitFor();
    const displayed = await page.locator('[class*="barberGrid"] button strong').allTextContents();
    assert.deepEqual(displayed, ['Bárki', ...TEAM.map(member => member.name)]);
    pass(`${width}px booking shows exactly the six home-page barbers, never the legacy profiles`);
    for (let index = 0; index < TEAM.length; index++) {
      await showTeam(page);
      const scene = page.locator('#csapat [aria-roledescription="carousel"]');
      await scene.focus();
      for (let step = 0; step < index; step++) { await page.keyboard.press('ArrowRight'); await settled(page, step + 1); }
      const link = page.locator('#csapat article[class*="activeCard"] a');
      const href = new URL(await link.getAttribute('href'), base);
      assert.equal(href.searchParams.get('barber'), staff[index].id);
      assert.equal(href.searchParams.get('barberName'), staff[index].name);
      await link.click();
      await page.getByRole('heading', { name: 'Miben segíthetünk?', exact: true }).waitFor();
      assert.ok((await page.locator('[class*="summaryRows"]').innerText()).includes(staff[index].name));
    }
    pass(`${width}px all six card CTAs open services with the exact selected barber and actual database ID`);
    await page.goto(base + '/idopontfoglalas?barber=stale-id&barberName=Neh%C3%A9z%20Zs%C3%ADros%20Bence');
    await page.getByRole('heading', { name: 'Miben segíthetünk?', exact: true }).waitFor();
    assert.ok((await page.locator('[class*="summaryRows"]').innerText()).includes('Nehéz Zsíros Bence'));
    pass(`${width}px a stale ID resolves safely through the full name`);
    await context.close();
  }
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true, isMobile: width < 500 });
    const page = await context.newPage(); await mockCatalog(page);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await showTeam(page);
    const scene = page.locator('#csapat [aria-roledescription="carousel"]');
    const card = page.locator('#csapat article[class*="activeCard"]');
    async function mouseDrag(dx, fromLink = false, dy = 0) {
      const box = await (fromLink ? card.locator('a') : card).boundingBox();
      const x = box.x + box.width * .6, y = box.y + box.height * (fromLink ? .5 : .3);
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 6 }); await page.mouse.up();
    }
    await mouseDrag(-30); await settled(page, 0);
    await mouseDrag(-60); await settled(page, 1);
    pass(`${width}px a normal 60px drag advances once; a 30px accidental move does not`);
    await mouseDrag(-65, true); await settled(page, 2);
    assert.equal(new URL(page.url()).pathname, '/');
    pass(`${width}px dragging from the booking CTA works without accidentally navigating`);
    const box = await card.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.wheel(75, 0); await settled(page, 3);
    await page.mouse.wheel(-75, 0); await settled(page, 2);
    const scroll = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 150); await page.waitForTimeout(150); await settled(page, 2);
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), scroll);
    pass(`${width}px horizontal trackpad gestures work in both directions; vertical scrolling preserves selection`);
    if (width === 390) {
      const cdp = await context.newCDPSession(page), r = await card.locator('a').boundingBox();
      const x = r.x + r.width * .65, y = r.y + r.height * .5;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 11, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await settled(page, 3);
      pass('real touch swipe from the booking CTA advances one card');
    }
    const currentIndex = width === 390 ? 3 : 2;
    await page.screenshot({ path: `${output}/gestures-${width}.png` });
    await card.locator('a').click();
    await page.getByRole('heading', { name: 'Miben segíthetünk?', exact: true }).waitFor();
    assert.ok((await page.locator('[class*="summaryRows"]').innerText()).includes(staff[currentIndex].name));
    assert.deepEqual(errors, []);
    pass(`${width}px an intentional CTA click after dragging selects the correct barber; no JavaScript errors`);
    await context.close();
  }
  console.log(`${passed} team-selection browser checks passed`);
} finally { await browser.close(); }
