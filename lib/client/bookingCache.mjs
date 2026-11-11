// Csak a nyilvános szolgáltatáslista és az anonim időpontok kerülnek ide.
// Vendégprofil, e-mail, auth token vagy foglalási rekord soha nem cache-elhető.
const CATALOG_TTL = 45_000;
const AVAILABILITY_TTL = 8_000;
const MAX_MONTH_ENTRIES = 24;
let catalogEntry = null;
let catalogRequest = null;
const months = new Map();
const requests = new Map();

async function readJson(url) {
  const response = await fetch(url, { credentials: "omit" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nem sikerült lekérni az időpontokat.");
  return data;
}

export async function loadPublicCatalog() {
  if (catalogEntry && catalogEntry.until > Date.now()) return catalogEntry.value;
  if (catalogRequest) return catalogRequest;
  const pending = readJson("/api/booking/config").then(value => {
    catalogEntry = { until: Date.now() + CATALOG_TTL, value };
    return value;
  });
  catalogRequest = pending;
  try { return await pending; }
  finally { if (catalogRequest === pending) catalogRequest = null; }
}

export function availabilityKey(service, barber, month) {
  return `${service}|${barber}|${month}`;
}

export function getCachedAvailability(service, barber, month) {
  const item = months.get(availabilityKey(service, barber, month));
  if (!item || item.until <= Date.now()) {
    if (item) months.delete(availabilityKey(service, barber, month));
    return null;
  }
  return item.value;
}

export function invalidateCachedAvailability(service, barber, month) {
  months.delete(availabilityKey(service, barber, month));
  // A 'Bárki' foglalások ugyanazokat a szabad idősávokat érintik.
  if (barber !== "any") months.delete(availabilityKey(service, "any", month));
}

export async function loadPublicAvailability(service, barber, month, { force = false } = {}) {
  const key = availabilityKey(service, barber, month);
  if (!force) {
    const cached = getCachedAvailability(service, barber, month);
    if (cached) return cached;
    if (requests.has(key)) return requests.get(key);
  }
  const params = new URLSearchParams({ service, barber, month });
  // Foglalási ütközéskor megkerüljük a rövid CDN-cache-t is.
  if (force) params.set("refresh", String(Date.now()));
  const pending = readJson(`/api/booking/availability?${params}`).then(data => {
    months.set(key, { until: Date.now() + AVAILABILITY_TTL, value: data });
    if (months.size > MAX_MONTH_ENTRIES) months.delete(months.keys().next().value);
    return data;
  });
  if (!force) requests.set(key, pending);
  try { return await pending; }
  finally { if (requests.get(key) === pending) requests.delete(key); }
}
