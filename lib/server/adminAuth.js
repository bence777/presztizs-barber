// SERVER ONLY: completely separate admin authentication cookies from guest identity.
// The same Supabase Auth provider verifies e-mail ownership, but a guest session
// is NEVER an admin session and guest profiles are NOT required for staff.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authApi } from './guestAuth.js';
import { clearDeviceCookie, verifyTrustedDevice } from './trustedDevices.js';

const ACCESS_COOKIE = 'pb_admin_access';
const REFRESH_COOKIE = 'pb_admin_refresh';
const DEADLINE_COOKIE = 'pb_admin_until';
const ADMIN_SESSION_SECONDS = 7 * 24 * 60 * 60;
const ADMIN_TEMP_SECONDS = 12 * 60 * 60;

function signAdminSession(userId, expiresAt, remember = true) {
  const payload = `${userId}.${expiresAt}.${remember ? "p" : "s"}`;
  const signature = createHmac('sha256', process.env.SESSION_SIGNING_SECRET)
    .update(`presztizs-admin-session:v1:${payload}`)
    .digest('hex');
  return `${payload}.${signature}`;
}
function verifiedAdminSession(raw) {
  if (typeof raw !== 'string') return null;
  const pieces = raw.split('.');
  if (pieces.length !== 4) return null;
  const [userId, expiresAt, mode, signature] = pieces;
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^\d{13}$/.test(expiresAt) || !['p','s'].includes(mode) || !/^[a-f0-9]{64}$/i.test(signature)) return null;
  const expected = signAdminSession(userId, expiresAt, mode==='p').split('.')[3];
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) return null;
  if (Number(expiresAt) <= Date.now()) return null;
  return { userId, expiresAt: Number(expiresAt), remember: mode === "p" };
}
function cookie(name, value, maxAge) {
  const age = maxAge === null ? '' : `; Max-Age=${maxAge}`;
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
function appendCookies(res, next) {
  const previous = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous : [previous]), ...next]);
}
export function clearAdminCookies(res) {
  appendCookies(res, [ACCESS_COOKIE, REFRESH_COOKIE, DEADLINE_COOKIE].map(name => cookie(name, '', 0)));
  clearDeviceCookie(res, 'admin');
}
export function setAdminCookies(res, tokens, userId, signedDeadline, remember = true) {
  const signed = signedDeadline || signAdminSession(userId, Date.now() + (remember ? ADMIN_SESSION_SECONDS : ADMIN_TEMP_SECONDS) * 1000, remember);
  const verified = verifiedAdminSession(signed);
  if (!verified || verified.userId !== userId || !tokens?.access_token || !tokens?.refresh_token) {
    throw new Error('invalid_admin_session');
  }
  // This is an absolute deadline, not a sliding 7-day window.
  const maxAge = verified.remember ? Math.max(1, Math.ceil((verified.expiresAt - Date.now()) / 1000)) : null;
  appendCookies(res, [
    cookie(ACCESS_COOKIE, tokens.access_token, maxAge),
    cookie(REFRESH_COOKIE, tokens.refresh_token, maxAge),
    cookie(DEADLINE_COOKIE, signed, maxAge),
  ]);
}
export async function getAdmin(req, res) {
  const access = req.cookies?.[ACCESS_COOKIE];
  const refresh = req.cookies?.[REFRESH_COOKIE];
  const signed = req.cookies?.[DEADLINE_COOKIE];
  if (!access || !refresh || !signed) return null;
  const device = verifiedAdminSession(signed);
  if (!device) { clearAdminCookies(res); return null; }
  const trusted = await verifyTrustedDevice(req, { userId: device.userId, scope: "admin" });
  if (!trusted) { clearAdminCookies(res); return null; }

  let current = await authApi('user', { bearer: access });
  let bearer = access;
  if (!current.ok && current.status !== 401 && current.status !== 403) {
    throw new Error(`admin_auth_unavailable_${current.status}`);
  }
  if (!current.ok) {
    const renewed = await authApi('token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: refresh },
    });
    if (!renewed.ok || !renewed.data?.access_token || !renewed.data?.refresh_token) {
      clearAdminCookies(res); return null;
    }
    bearer = renewed.data.access_token;
    current = await authApi('user', { bearer });
    if (!current.ok) { clearAdminCookies(res); return null; }
    if (current.data?.id === device.userId) {
      setAdminCookies(res, renewed.data, device.userId, signed);
    }
  }
  const user = current.data;
  if (!user?.id || !user?.email || user.id !== device.userId) {
    clearAdminCookies(res); return null;
  }
  return { user, token: bearer };
}

export function normalizedAdminEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
