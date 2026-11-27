// Real touch events in a mobile Chromium context. Read-only SSR fixtures required.
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.join(process.env.DEMETERS_QA_MODULES || process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const base = process.env.DEMETERS_PREVIEW_URL || 'http://127.0.0.1:3114';
const browser = await chromium.launch({ headless: true, ...(process.env.DEMETERS_BROWSER ? { executablePath: process.env.DEMETERS_BROWSER } : {}) });
let passed = 0;
const pass = label => { console.log('PASS ' + label); passed++; };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 950 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    assert.equal(route.request().method(), 'GET', 'Never submit a real booking');
    if (new URL(route.request().url()).pathname === '/api/booking/config') return route.continue();
    throw new Error('Unexpected API');
  });
  const cdp = await context.newCDPSession(page);
  async function sample(scope) {
    return page.locator(scope).evaluate(container => {
      const cards = [...container.querySelectorAll('article')];
      const index = cards.findIndex(card => card.className.includes('activeCard'));
      const card = cards[index];
      const spacing = parseFloat(getComputedStyle(container.querySelector('[aria-roledescription=carousel]')).getPropertyValue('--card-width')) * .76;
      return { value: index - new DOMMatrixReadOnly(getComputedStyle(card).transform).m41 / spacing, count: cards.length };
    });
  }
  const delta = (before, after) => ((after.value - before.value + before.count * 1.5) % before.count) - before.count / 2;
  async function start(scope) {
    const scene = page.locator(scope + ' [aria-roledescription=carousel]');
    await scene.scrollIntoViewIfNeeded();
    const box = await scene.boundingBox();
    const point = { x: box.x + box.width * .75, y: box.y + box.height * .42 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    return point;
  }
  async function move(point, dx, duration = 70) {
    // Pipeline samples: native touch acknowledgements can wait multiple frames.
    const moves = [];
    for (let i = 1; i <= 5; i++) {
      moves.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + dx * i / 5, y: point.y }] }));
      await page.waitForTimeout(duration / 5);
    }
    await Promise.all(moves);
  }
  async function end(cancel = false) { await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] }); }
  for (const scope of ['#csapat', '#foglalas']) {
    await page.goto(base + (scope === '#foglalas' ? '/#foglalas' : '/#csapat'));
    await page.locator(scope + ' article').first().waitFor();
    const point = await start(scope); await move(point, -95, 45);
    const released = await sample(scope); await end();
    await page.waitForTimeout(180); const coasted = await sample(scope);
    assert.ok(delta(released, coasted) > .25, `${scope}: must continue after touchEnd`);
    let prior = coasted, travel = delta(released, coasted);
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(100); const next = await sample(scope); const step = delta(prior, next);
      assert.ok(step >= -.025, `${scope}: momentum reversed after release (${step})`);
      travel += step; prior = next;
    }
    assert.ok(travel > 1, `${scope}: fast flick should coast across more than one additional barber`);
    pass(`${scope}: fast mobile flick coasts across several barbers without reversing`);
    await page.waitForTimeout(800);
    const second = await start(scope); await move(second, -180, 80); await end();
    await page.waitForTimeout(80);
    const grab = await start(scope); const stopped = await sample(scope);
    await page.waitForTimeout(250); assert.ok(Math.abs(delta(stopped, await sample(scope))) < .04);
    await move(grab, 85, 70); const rightRelease = await sample(scope); await end();
    await page.waitForTimeout(180); assert.ok(delta(rightRelease, await sample(scope)) < -.2);
    pass(`${scope}: touching stops momentum immediately and a new right swipe reverses direction`);
    await page.waitForTimeout(2200);
    const beforeCancel = await sample(scope); const third = await start(scope); await move(third, -265, 300);
    const atCancel = await sample(scope); await end(true); await page.waitForTimeout(1800);
    assert.ok(Math.abs(delta(atCancel, await sample(scope))) <= .52, 'Cancel must settle near current position');
    assert.ok(Math.abs(delta(beforeCancel, await sample(scope))) > .5, 'Cancel must not reset to the gesture origin');
    pass(`${scope}: cancelled touch settles in place instead of jumping to the starting barber`);
    const scene = page.locator(scope + ' [aria-roledescription=carousel]');
    await scene.focus(); await page.keyboard.press('End');
    await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-busy') === 'false', scope + ' [aria-roledescription=carousel]');
    const lastBarber = await sample(scope);
    const wrapSwipe = await start(scope); await move(wrapSwipe, -95, 45); await end();
    let cursor = lastBarber, total = 0;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(90); const next = await sample(scope); const step = delta(cursor, next);
      assert.ok(step >= -.025, 'Crossing the final barber must not reverse the carousel');
      total += step; cursor = next;
    }
    assert.ok(total > 1, 'Must continue past the last barber');
    pass(`${scope}: inertia wraps past the final barber in the same direction`);
    assert.equal(new URL(page.url()).searchParams.get('barber'), null, 'Swipes must never open a booking');
  }
  assert.deepEqual(errors, []);
  console.log(`${passed} mobile inertia checks passed`);
} finally { await browser.close(); }
