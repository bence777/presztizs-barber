// No tracker is installed by this module. An existing consent manager must call
// setAnalyticsConsent(true) before any event is emitted. No event queue or cookies.
let consent = false;
const EVENTS = new Set(['booking_started', 'barber_selected', 'service_selected', 'booking_completed', 'phone_clicked', 'directions_clicked', 'barber_profile_viewed']);
const FIELDS = new Set(['barber_id', 'service_id', 'language', 'placement']);
export function setAnalyticsConsent(allowed) { consent = allowed === true; }
export function trackEvent(name, properties = {}) {
  if (typeof window === 'undefined' || !consent || !EVENTS.has(name) || navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  const payload = Object.fromEntries(Object.entries(properties).filter(([key, value]) => FIELDS.has(key) && typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value)));
  // This CustomEvent has no default network transport. Consumers must keep their
  // analytics page-location/referrer settings free of booking query strings.
  window.dispatchEvent(new CustomEvent('demeters:analytics', { detail: { event: name, ...payload } }));
}
