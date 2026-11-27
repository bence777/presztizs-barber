// Short on/off pulses are all the browser API exposes; intensity is device-owned.
export function createCarouselHaptics({ vibrate, allowed, now }) {
  let active = false, crossed = false, startIndex, count = 0, lastPulse = -Infinity;
  function pulse(duration, interval) {
    if (!allowed() || now() - lastPulse < interval) return false;
    try {
      if (vibrate(duration) === false) return false;
      lastPulse = now();
      return true;
    } catch { return false; }
  }
  return {
    begin(index) { active = true; startIndex = index; crossed = false; count = 0; },
    tick(speed = 0) {
      if (!active) return;
      crossed = true;
      // Fast flings skip ticks instead of turning into a continuous buzz.
      if (count < 9 && pulse(6, Math.abs(speed) > 4 ? 160 : 100)) count++;
    },
    finish(index) {
      const shouldPulse = active && (crossed || index !== startIndex);
      active = false;
      if (shouldPulse) pulse(10, 85);
    },
    cancel() {
      if (active && count > 0) { try { vibrate(0); } catch {} }
      active = false; crossed = false;
    },
  };
}
