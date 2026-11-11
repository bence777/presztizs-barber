import { createHmac, timingSafeEqual } from "node:crypto";
import { bookingDb } from "./bookingDb.js";
import { clearDeviceCookie, verifyTrustedDevice } from "./trustedDevices.js";

// All Supabase calls run exclusively on the Next.js server. No service role key is needed.
const COOKIE_AT = "pb_access";
const COOKIE_RT = "pb_refresh";
const COOKIE_UNTIL = "pb_device_until";
const SECONDS_60_DAYS = 60 * 24 * 60 * 60;
const SECONDS_SESSION = 12 * 60 * 60;

export function isConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_") &&
    process.env.SESSION_SIGNING_SECRET &&
    process.env.SESSION_SIGNING_SECRET.length >= 32
  );
}

export function jsonOnly(req, res, method) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!isConfigured()) {
    res.status(503).json({ error: "A foglalási azonosítás még nincs konfigurálva." });
    return false;
  }
  if (req.method !== method) {
    res.setHeader("Allow", method);
    res.status(405).json({ error: "Nem támogatott művelet." });
    return false;
  }
  if (method !== "GET") {
    const origin = req.headers.origin;
    const host = req.headers.host;
    // Require same-origin browser requests; this also blocks ordinary cross-site form CSRF.
    let valid = false;
    try {
      valid = Boolean(origin && host && new URL(origin).host === host &&
        (new URL(origin).protocol === "https:" || (process.env.NODE_ENV !== "production" && new URL(origin).protocol === "http:")));
    } catch { /* invalid origin */ }
    if (!valid) {
      res.status(403).json({ error: "Érvénytelen kérésforrás." });
      return false;
    }
  }
  return true;
}

async function requestSupabase(path, { method = "GET", bearer, body, prefer } = {}) {
  const url = new URL(path, process.env.SUPABASE_URL);
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: apiKey,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON error */ }
  return { ok: response.ok, status: response.status, data };
}

export function authApi(path, opts = {}) {
  return requestSupabase(`/auth/v1/${path}`, opts);
}

function signDevice(userId, deadline, remember) {
  const message = `${userId}.${deadline}.${remember ? "p" : "s"}`;
  const signature = createHmac("sha256", process.env.SESSION_SIGNING_SECRET).update(message).digest("hex");
  return `${message}.${signature}`;
}

function verifyDevice(raw, userId) {
  if (typeof raw !== "string") return null;
  const [id, deadlineText, mode, signature, extra] = raw.split(".");
  if (extra || (userId && id !== userId) || !/^[0-9a-f-]{36}$/.test(id || "") ||
      !/^\d{13}$/.test(deadlineText) || !["p", "s"].includes(mode) ||
      !/^[0-9a-f]{64}$/.test(signature || "")) return null;
  const expected = signDevice(id, deadlineText, mode === "p").split(".")[3];
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) return null;
  return Number(deadlineText) > Date.now() ? { id, remember: mode === "p" } : null;
}

function makeCookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const age = maxAge === null ? "" : `; Max-Age=${maxAge}`;
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}${age}`;
}

function attachCookies(res, cookies) {
  const prev = res.getHeader("Set-Cookie") || [];
  res.setHeader("Set-Cookie", [...(Array.isArray(prev) ? prev : [prev]), ...cookies]);
}

export function clearGuestCookies(res) {
  attachCookies(res, [COOKIE_AT, COOKIE_RT, COOKIE_UNTIL].map((key) => makeCookie(key, "", 0)));
  clearDeviceCookie(res, "guest");
}

export function setGuestCookies(res, session, userId, { remember = true, signedDevice } = {}) {
  const deadline = signedDevice || signDevice(userId, Date.now() + (remember ? SECONDS_60_DAYS : SECONDS_SESSION) * 1000, remember);
  const maxAge = remember ? Math.max(1, Math.ceil((Number(deadline.split(".")[1]) - Date.now()) / 1000)) : null; // absolute expiry, not sliding
  attachCookies(res, [
    makeCookie(COOKIE_AT, session.access_token, maxAge),
    makeCookie(COOKIE_RT, session.refresh_token, maxAge),
    makeCookie(COOKIE_UNTIL, deadline, maxAge),
  ]);
}

function cookieValue(req, key) {
  return typeof req.cookies?.[key] === "string" ? req.cookies[key] : null;
}

export async function getGuest(req, res) {
  const access = cookieValue(req, COOKIE_AT);
  const refresh = cookieValue(req, COOKIE_RT);
  const signedDevice = cookieValue(req, COOKIE_UNTIL);
  if (!access || !refresh || !signedDevice) return null;
  const device = verifyDevice(signedDevice);
  if (!device) { clearGuestCookies(res); return null; }
  // Server-side revocation is checked on every privileged request.
  const trusted = await verifyTrustedDevice(req, { userId: device.id, scope: "guest" });
  if (!trusted) { clearGuestCookies(res); return null; }

  let response = await authApi("user", { bearer: access });
  let token = access;

  if (!response.ok && response.status !== 401 && response.status !== 403) {
    throw new Error(`auth_user_${response.status}`);
  }
  if (!response.ok) {
    const renewed = await authApi("token?grant_type=refresh_token", {
      method: "POST", body: { refresh_token: refresh },
    });
    if (!renewed.ok || !renewed.data?.access_token || !renewed.data?.refresh_token) {
      clearGuestCookies(res);
      return null;
    }
    token = renewed.data.access_token;
    response = await authApi("user", { bearer: token });
    if (!response.ok) {
      clearGuestCookies(res);
      return null;
    }
    // Refresh tokens rotate. Do not reset the 60-day *absolute* deadline.
    setGuestCookies(res, renewed.data, response.data.id, {
      signedDevice, remember: device.remember,
    });
  }

  const user = response.data;
  if (!user?.id || !user?.email || !verifyDevice(signedDevice, user.id)) {
    clearGuestCookies(res);
    return null;
  }
  return { user, token };
}

export async function getProfile(guest) {
  const rows = await bookingDb("guest_profiles", {
    query: { user_id: `eq.${guest.user.id}`, select: "full_name,phone", limit: "1" },
  });
  return rows[0] || null;
}

export async function upsertProfile(guest, fullName, phone) {
  const rows = await bookingDb("guest_profiles", {
    method: "POST",
    query: {on_conflict: "user_id"},
    prefer: "resolution=merge-duplicates,return=representation",
    body: { user_id: guest.user.id, full_name: fullName, phone },
  });
  return rows[0] || null;
}

export function maskEmail(email) {
  const [local, domain] = (email || "").split("@");
  if (!local || !domain) return "";
  return `${local[0]}${"•".repeat(Math.min(5, Math.max(1, local.length - 1)))}@${domain}`;
}

export function safeApiError(res, error, label) {
  console.error(`[guest-auth] ${label}`, error instanceof Error ? error.message : String(error));
  return res.status(502).json({ error: "A szolgáltatás átmenetileg nem érhető el. Próbáld újra később." });
}
