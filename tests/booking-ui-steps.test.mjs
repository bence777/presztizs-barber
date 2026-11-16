import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../components/BookingWizard.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/BookingWizard.module.css', import.meta.url), 'utf8');

test('Booking keeps its selection summary, edit actions and mobile progress', () => {
  assert.match(code, /styles\.topline/);
  assert.match(code, /styles\.steps\b/);
  assert.match(code, /styles\.summaryBottom/);
  assert.match(code, /styles\.summaryRows/);
  assert.match(code, /styles\.mobileSteps/);
  for (const label of ['Szolgáltatás', 'Barber', 'Időpont', 'Adataid']) {
    assert.ok(code.includes(`aria-label="${label} módosítása"`));
  }
  assert.match(code, /STEPS\.map\(\(label, index\)/);
  assert.equal((code.match(/FOGLALÁSI FOLYAMAT/g) || []).length, 1);
  assert.match(css, /\.steps\s*\{/);
  assert.match(css, /@media \(max-width: 800px\)[\s\S]*?\.mobileSteps\s*\{/);
});
