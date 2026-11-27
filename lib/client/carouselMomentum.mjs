// Pointer samples use pixels / milliseconds; the carousel uses cards / second.
export function releaseVelocity(samples, now, spacing) {
  if (!samples.length || spacing <= 0) return 0;
  const last = samples[samples.length - 1];
  if (now - last.time > 90) return 0;
  const recent = samples.filter(sample => now - sample.time <= 120);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const elapsed = now - first.time;
  if (elapsed < 8) return 0;
  return Math.max(-12, Math.min(12, -(last.x - first.x) / elapsed * 1000 / spacing));
}

export function momentumTarget(position, velocity, power = .34) {
  const projected = position + velocity * power;
  // Keep the unwrapped position: a fast swipe can cross the last barber and
  // continue forward. Choosing the shortest route here causes a reverse jump.
  if (velocity > .25) return Math.max(Math.ceil(position), Math.round(projected));
  if (velocity < -.25) return Math.min(Math.floor(position), Math.round(projected));
  return Math.round(position);
}
