import test from 'node:test';
import assert from 'node:assert/strict';
import { gestureAxis } from '../lib/client/carouselGesture.mjs';
test('diagonal gestures up and down retain horizontal intent', () => {
  for(const [x,y] of [[20,20],[-20,20],[20,-20],[-20,-20],[20,28]])assert.equal(gestureAxis(x,y),'x');
});
test('vertical page scrolling and tiny jitter are not captured', () => {
  assert.equal(gestureAxis(3,4),null);assert.equal(gestureAxis(2,20),'y');assert.equal(gestureAxis(-5,-30),'y');
});
test('the chosen axis remains locked even when the finger curves later', () => {
  assert.equal(gestureAxis(20,100,'x'),'x');assert.equal(gestureAxis(100,20,'y'),'y');
});
test('diagonal trackpad input can use the same direction lock at wheel resolution', () => {
  assert.equal(gestureAxis(2,2,null,1),'x');assert.equal(gestureAxis(.1,4,null,1),'y');
});
