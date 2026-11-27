import test from 'node:test';
import assert from 'node:assert/strict';
import { createCarouselHaptics } from '../lib/client/carouselHaptics.mjs';
function fixture() {
  const pulses = []; let time = 0, enabled = true;
  const controller = createCarouselHaptics({ vibrate: ms => { pulses.push(ms); return true; }, allowed: () => enabled, now: () => time });
  return { controller, pulses, advance: ms => { time += ms; }, disable: () => { enabled = false; } };
}
test('initial rendering and programmatic selections do not vibrate', () => {
  const f = fixture(); f.controller.tick(); f.controller.finish(); f.controller.cancel(); assert.deepEqual(f.pulses, []);
});
test('touch transitions get one short tick; settling gets a distinct subtle pulse', () => {
  const f = fixture(); f.controller.begin(); f.controller.tick(1); f.advance(300); f.controller.finish(); f.controller.finish(); assert.deepEqual(f.pulses, [6, 10]);
});
test('fast fling pulses are spaced out and have a fixed budget', () => {
  const f = fixture(); f.controller.begin();
  for (let i=0;i<100;i++) { f.controller.tick(10); f.advance(20); }
  assert.equal(f.pulses.length,9); assert.ok(f.pulses.every(ms=>ms===6));
  f.controller.finish(); assert.equal(f.pulses.at(-1),10);
});
test('holding without changing a barber produces no tick or settle pulse', () => {
  const f = fixture(); f.controller.begin(); f.advance(1000); f.controller.finish(); assert.deepEqual(f.pulses,[]);
});
test('opt-out, hidden/unsupported state and cancellation prevent later pulses', () => {
  const f = fixture(); f.controller.begin(); f.controller.tick(); f.disable(); f.controller.cancel(); f.advance(1000); f.controller.tick(); f.controller.finish(); assert.deepEqual(f.pulses,[6,0]);
});
test('immediate stop after a tick does not stack another vibration', () => {
  const f = fixture(); f.controller.begin(); f.controller.tick(); f.advance(20); f.controller.finish(); assert.deepEqual(f.pulses,[6]);
});
test('unavailable hardware and rejected vibration calls never break carousel input', () => {
  const f=createCarouselHaptics({vibrate:()=>{throw new Error('not supported')},allowed:()=>true,now:()=>1000});
  assert.doesNotThrow(()=>{f.begin();f.tick();f.finish();f.cancel()});
});

test('a short swipe landing on a new barber gets a landing pulse without a duplicate centre tick', () => {
  const f = fixture(); f.controller.begin(0); f.controller.finish(1); assert.deepEqual(f.pulses,[10]);
});
