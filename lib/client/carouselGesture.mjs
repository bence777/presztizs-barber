// Decide once, then keep the chosen axis until this gesture ends. A sideways
// intent can include substantial vertical drift (roughly up to 57 degrees).
export function gestureAxis(dx, dy, locked = null, threshold = 8) {
  if (locked) return locked;
  const x = Math.abs(dx), y = Math.abs(dy);
  if (Math.hypot(x, y) < threshold) return null;
  if (x >= threshold / 2 && x >= y * .65) return 'x';
  return 'y';
}
