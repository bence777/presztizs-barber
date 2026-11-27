import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseVelocity, momentumTarget } from '../lib/client/carouselMomentum.mjs';

test('fast short flick continues forward instead of resetting to the initial barber', () => {
  const speed = releaseVelocity([{ x: 200, time: 0 }, { x: 175, time: 20 }], 22, 180);
  assert.ok(speed > 5);
  assert.ok(momentumTarget(.14, speed) >= 2);
});
test('left and right flicks cross multiple barbers and wrap without reversing', () => {
  assert.ok(momentumTarget(5.8, 10) > 6);
  assert.ok(momentumTarget(.2, -10) < 0);
  assert.ok(momentumTarget(2.1, .5) >= 3);
  assert.ok(momentumTarget(2.9, -.5) <= 2);
});
test('holding still before release removes momentum; only recent movement sets speed', () => {
  assert.equal(releaseVelocity([{ x: 200, time: 0 }, { x: 100, time: 30 }], 150, 180), 0);
  const samples = [{ x: 300, time: 0 }, { x: 80, time: 150 }, { x: 110, time: 180 }];
  assert.ok(releaseVelocity(samples, 182, 180) < 0);
});
test('stationary/cancelled input settles near the current position, not the gesture origin', () => {
  assert.equal(momentumTarget(3.8, 0), 4);
  assert.equal(momentumTarget(-2.7, 0), -3);
  assert.equal(releaseVelocity([], 10, 180), 0);
});
