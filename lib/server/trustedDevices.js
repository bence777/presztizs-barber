// SERVER ONLY. Cookie-bound sessions, not hardware or browser fingerprinting.
// Persist ONLY a random credential's SHA-256 hash and an intentionally coarse label.
import { createHash, randomBytes } from 'node:crypto';
import { bookingDb } from './bookingDb.js';

const COOKIES = { guest: 'pb_trusted_device', admin: 'pb_admin_trusted_device' };
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOUCH_INTERVAL = 6 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const lifetime = maxAge === null ? '' : `; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}${lifetime}`;
}
function appendCookie(res, next) {
  const previous = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous : [previous]), next]);
}
export function clearDeviceCookie(res, scope) {
  appendCookie(res, cookie(COOKIES[scope], '', 0));
}
export function setDeviceCookie(res, scope, token, expiresAt, persistent) {
  const maxAge = persistent ? Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000)) : null;
  appendCookie(res, cookie(COOKIES[scope], token, maxAge));
}
export function deviceCredential(req, scope) {
  const value = req.cookies?.[COOKIES[scope]];
  return typeof value === 'string' && TOKEN_PATTERN.test(value) ? value : null;
}
function hashCredential(value) {
  return createHash('sha256').update(value).digest('hex');
}

// User agent is only used IN MEMORY to generate a broad human-readable label.
// Never save a full UA, IP, fingerprint, location, hardware attributes, or tracking ID.
export function coarseDeviceLabel(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.slice(0, 1024) : '';
  const platform = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' :
    /Macintosh|Mac OS/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' :
    /Linux/i.test(ua) ? 'Linux' : 'Ismeretlen rendszer';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox\//i.test(ua) ? 'Firefox' :
    /CriOS|Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Böngésző';
  return `${browser} · ${platform}`;
}
export async function registerTrustedDevice(req, { userId, scope, expiresAt }) {
  if (!COOKIES[scope] || !UUID.test(userId) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('invalid_device_registration');
  }
  // Multiple devices are allowed. A new OTP on the same browser replaces only
  // that browser's previous record, without invalidating other sessions.
  const old = deviceCredential(req, scope);
  const oldHash = old ? hashCredential(old) : null;
  const rawToken = randomBytes(32).toString('base64url');
  const entry = await bookingDb('trusted_devices', {
    method: 'POST', prefer: 'return=representation',
    body: {
      user_id: userId, scope, credential_hash: hashCredential(rawToken),
      device_name: coarseDeviceLabel(req.headers?.['user-agent']),
      expires_at: new Date(expiresAt).toISOString(),
    },
  });
  if (!entry?.[0]?.id) throw new Error('device_registration_failed');
  // Re-authentication on the SAME browser replaces only the prior browser credential.
  if (oldHash) {
    try {
      await bookingDb('trusted_devices', { method: 'DELETE',
        query: { user_id: `eq.${userId}`, scope: `eq.${scope}`, credential_hash: `eq.${oldHash}` },
      });
    } catch (error) { console.warn('[trusted-devices] old credential cleanup:', error?.code || error?.message); }
  }
  return rawToken;
}
export async function verifyTrustedDevice(req, { userId, scope }) {
  const raw = deviceCredential(req, scope);
  if (!raw || !UUID.test(userId)) return null;
  const hash = hashCredential(raw);
  const rows = await bookingDb('trusted_devices', {
    query: { select: 'id,user_id,scope,last_seen_at,expires_at', user_id: `eq.${userId}`, scope: `eq.${scope}`,
      credential_hash: `eq.${hash}`, expires_at: `gt.${new Date().toISOString()}`, limit: '1' },
  });
  const found = rows?.[0];
  if (!found) return null;
  if (Date.now() - new Date(found.last_seen_at).getTime() > TOUCH_INTERVAL) {
    // This write can be batched; its failure must not turn into an authentication bypass.
    await bookingDb('trusted_devices', { method: 'PATCH',
      query: { id: `eq.${found.id}`, user_id: `eq.${userId}`, scope: `eq.${scope}` },
      body: { last_seen_at: new Date().toISOString() },
    });
  }
  return found;
}
export async function listTrustedDevices(req, { userId, scope }) {
  const current = deviceCredential(req, scope);
  const hash = current ? hashCredential(current) : null;
  const rows = await bookingDb('trusted_devices', {
    query: { select: 'id,device_name,created_at,last_seen_at,expires_at,credential_hash',
      user_id: `eq.${userId}`, scope: `eq.${scope}`, expires_at: `gt.${new Date().toISOString()}`,
      order: 'last_seen_at.desc', limit: '100' },
  });
  return rows.map(({credential_hash, ...entry}) => ({...entry, current: credential_hash === hash}));
}
export async function renameTrustedDevice({userId, scope, id, name}) {
  if (!UUID.test(id) || typeof name !== 'string') return false;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2 || cleaned.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) return false;
  const updated = await bookingDb('trusted_devices', {method: 'PATCH', prefer: 'return=representation',
    query: {id:`eq.${id}`,user_id:`eq.${userId}`,scope:`eq.${scope}`,select:'id'},
    body: {device_name:cleaned},
  });
  return updated?.length === 1;
}
export async function removeTrustedDevice({userId, scope, id}) {
  if (!UUID.test(id)) return false;
  const deleted = await bookingDb('trusted_devices', {method: 'DELETE',prefer: 'return=representation',
    query: {id:`eq.${id}`,user_id:`eq.${userId}`,scope:`eq.${scope}`,select:'id'},
  });
  return deleted?.length === 1;
}
export async function removeCurrentTrustedDevice(req, {userId, scope}) {
  const raw = deviceCredential(req, scope);
  if (!raw) return;
  await bookingDb('trusted_devices', {method: 'DELETE',
    query: {user_id:`eq.${userId}`,scope:`eq.${scope}`,credential_hash:`eq.${hashCredential(raw)}`},
  });
}
