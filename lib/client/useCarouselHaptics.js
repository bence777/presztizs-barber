import { useEffect, useRef, useState } from 'react';
import { createCarouselHaptics } from './carouselHaptics.mjs';
const KEY = 'demeters-haptics';
const EVENT = 'demeters:haptics-preference';
let preferred = null;
const silent = { begin() {}, tick() {}, finish() {}, cancel() {} };

export default function useCarouselHaptics() {
  const controller = useRef(silent);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const supported = () => typeof navigator.vibrate === 'function' && navigator.maxTouchPoints > 0 && !motion.matches;
    const sync = () => {
      setEnabled(preferred !== false); setAvailable(supported());
      if (!preferred || !supported()) controller.current.cancel();
    };
    controller.current = createCarouselHaptics({
      vibrate: duration => navigator.vibrate(duration),
      allowed: () => supported() && preferred !== false && document.visibilityState === 'visible' && navigator.userActivation?.hasBeenActive !== false,
      now: () => performance.now(),
    });
    const visibility = () => { if (document.visibilityState !== 'visible') controller.current.cancel(); };
    const read = () => {
      try { const stored = localStorage.getItem(KEY); if (stored !== null || preferred === null) preferred = stored !== 'off'; } catch { if (preferred === null) preferred = true; }
      sync();
    };
    const storage = event => { if (event.key === KEY || event.key === null) { preferred = null; read(); } };
    read();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', sync);
    return () => {
      controller.current.cancel(); controller.current = silent;
      window.removeEventListener(EVENT, sync); window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', sync);
    };
  }, []);
  function toggle() {
    preferred = !enabled;
    try { localStorage.setItem(KEY, preferred ? 'on' : 'off'); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }
  return { controller, available, enabled, toggle };
}
