// controllers/authController.js (ESM)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
// controllers/authController.js (additions)
import jwt from 'jsonwebtoken';
import {
  createSession,
  validateSession,
  rotateSession,
  revokeAllUserSessions,
} from '../services/tokenStore.js';

const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.REFRESH_TTL || '30d';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

const COOKIE_NAME = process.env.COOKIE_NAME || 'mc_token';
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'mc_refresh';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

function parseDurToSec(s) {
  if (!isNaN(Number(s))) return Number(s);
  const m = String(s).match(/^(\d+)([smhd])$/i);
  if (!m) return 3600;
  const n = Number(m[1]); const u = m[2].toLowerCase();
  return u === 's' ? n : u === 'm' ? n * 60 : u === 'h' ? n * 3600 : n * 86400;
}
const REFRESH_TTL_SEC = parseDurToSec(REFRESH_TTL);
const ACCESS_TTL_SEC  = parseDurToSec(ACCESS_TTL);

function setTokenCookies(res, { accessToken, refreshToken }) {
  const base = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    domain: COOKIE_DOMAIN,
    path: '/',
  };
  res.cookie(COOKIE_NAME, accessToken, { ...base, maxAge: ACCESS_TTL_SEC * 1000 });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...base, maxAge: REFRESH_TTL_SEC * 1000 });
  }
}

function clearAuthCookies(res) {
  const base = { httpOnly: true, secure: COOKIE_SECURE, sameSite: COOKIE_SAMESITE, domain: COOKIE_DOMAIN, path: '/' };
  res.clearCookie(COOKIE_NAME, base);
  res.clearCookie(REFRESH_COOKIE_NAME, base);
}

export async function issueSessionCookiesForUser(res, userId, req) {
  const jti = await createSession(userId, REFRESH_TTL_SEC, {
    ua: (req.headers['user-agent'] || '').slice(0, 128),
    ip: req.ip,
  });

  const accessToken  = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign({ sub: userId, jti }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

  setTokenCookies(res, { accessToken, refreshToken });
  return { accessToken, refreshToken };
}

// POST /auth/refresh (CSRF-protected)
export async function refresh(req, res) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET); // { sub, jti }
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const sess = await validateSession(payload.jti);
    if (!sess || sess.userId !== payload.sub) {
      return res.status(401).json({ success: false, message: 'Refresh session not found' });
    }

    const newJti = await rotateSession(
      payload.jti,
      payload.sub,
      REFRESH_TTL_SEC,
      { ua: (req.headers['user-agent'] || '').slice(0, 128), ip: req.ip }
    );

    const accessToken = jwt.sign({ sub: payload.sub }, JWT_SECRET, { expiresIn: ACCESS_TTL });
    const newRefresh  = jwt.sign({ sub: payload.sub, jti: newJti }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

    setTokenCookies(res, { accessToken, refreshToken: newRefresh });
    return res.json({ success: true, accessToken });
  } catch {
    return res.status(500).json({ success: false, message: 'Refresh failed' });
  }
}

// POST /auth/logout-everywhere (auth + CSRF)
export async function logoutEverywhere(req, res) {
  try {
    const userId = (req.user?.id || req.user?._id || '').toString();
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    await revokeAllUserSessions(userId);
    clearAuthCookies(res);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: 'Logout failed' });
  }
}

const {
  JWT_SECRET = 'dev-secret',
  JWT_EXPIRES_IN = '7d',
  ACCESS_COOKIE_NAME = 'mc_token',
  NODE_ENV = 'development',
} = process.env;

const isProd = NODE_ENV === 'production';

// ---------- (Optional) Redis for global logout ----------
let redis = null;
async function getRedisClient() {
  if (redis !== null) return redis;
  try {
    // If you created lib/redis.js earlier
    const mod = await import('../lib/redis.js').catch(() => null);
    if (mod?.getRedis) {
      redis = mod.getRedis();
    } else {
      redis = null;
    }
  } catch {
    redis = null;
  }
  return redis;
}
async function getLogoutAllAfter(userId) {
  const r = await getRedisClient();
  if (!r) return 0;
  try {
    const v = await r.get(`logout_all_after:${userId}`);
    return Number(v || 0);
  } catch {
    return 0;
  }
}
async function setLogoutAllAfter(userId, epochSeconds) {
  const r = await getRedisClient();
  if (!r) return false;
  try {
    await r.set(`logout_all_after:${userId}`, String(epochSeconds));
    return true;
  } catch {
    return false;
  }
}

// ---------- helpers ----------
function sign(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function setAuthCookie(res, token) {
  res.cookie(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',      // change to 'none' if you truly need cross-site cookies
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
}

function safeUser(u) {
  if (!u) return null;
  const src = typeof u.toObject === 'function' ? u.toObject() : u;
  const { _id, id, name, email, role, createdAt, updatedAt } = src;
  return { _id: _id || id, name, email, role, createdAt, updatedAt };
}

function readToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE_NAME] || null;
}

// ---------- controllers ----------
export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Invalid signup payload' });
    }

    const lower = email.toLowerCase();
    const existing = await User.findOne({ email: lower });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: lower, password: hash, role: 'student' });

    const token = sign(user._id);
    setAuthCookie(res, token);

    return res.status(201).json({ success: true, user: safeUser(user) });
  } catch (err) {
    if (next) return next(err);
    return res.status(500).json({ success: false, message: 'Signup failed' });
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Invalid login payload' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    let ok = false;
    if (user.password && user.password.startsWith('$2')) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = password === user.password; // legacy/plain support (optional)
    }
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = sign(user._id);
    setAuthCookie(res, token);

    return res.json({ success: true, user: safeUser(user) });
  } catch (err) {
    if (next) return next(err);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
}

export async function me(req, res) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ user: null });

    const payload = jwt.verify(token, JWT_SECRET);
    // Optional global-logout check (Redis)
    const cutoff = await getLogoutAllAfter(payload.sub);
    const iat = Number(payload.iat || 0); // JWT iat is seconds
    if (cutoff && iat < cutoff) {
      return res.status(401).json({ user: null });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ user: null });

    return res.json({ user: safeUser(user) });
  } catch {
    return res.status(401).json({ user: null });
  }
}

export async function logout(_req, res) {
  clearAuthCookie(res);
  return res.json({ success: true });
}

/**
 * POST /auth/refresh
 * If a valid token (cookie or Bearer) is present and not globally revoked,
 * issue a fresh token and set cookie again.
 */
export async function refresh(req, res) {
  try {
    const old = readToken(req);
    if (!old) return res.status(401).json({ success: false, message: 'Missing token' });

    const payload = jwt.verify(old, JWT_SECRET);
    const cutoff = await getLogoutAllAfter(payload.sub);
    const iat = Number(payload.iat || 0);
    if (cutoff && iat < cutoff) {
      return res.status(401).json({ success: false, message: 'Session revoked' });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: 'Unknown user' });

    const fresh = sign(user._id);
    setAuthCookie(res, fresh);
    return res.json({ success: true, user: safeUser(user) });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/**
 * POST /auth/logout-everywhere
 * Requires auth. With Redis: sets a per-user cutoff; all tokens issued before are invalid.
 * Without Redis: clears current cookie and returns a note.
 */
export async function logoutEverywhere(req, res) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Missing token' });

    const payload = jwt.verify(token, JWT_SECRET);
    const nowSec = Math.floor(Date.now() / 1000);

    const ok = await setLogoutAllAfter(payload.sub, nowSec);
    clearAuthCookie(res);

    if (ok) {
      return res.json({ success: true, message: 'All sessions revoked' });
    }
    // No Redis available—best effort for current device only
    return res.json({ success: true, message: 'Logged out on this device. (Global logout requires Redis.)' });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
export const logout = (req, res) => {
  const name = process.env.COOKIE_NAME || 'mc_token';
  res.clearCookie(name, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE || 'Lax')
  });
  return res.json({ success: true });
};
// controllers/authController.js (add near top)
import jwt from 'jsonwebtoken';
import {
  createSession,
  validateSession,
  rotateSession,
  revokeAllUserSessions,
} from '../services/tokenStore.js';

const ACCESS_TTL = process.env.ACCESS_TTL || '15m';            // e.g. 15m
const REFRESH_TTL = process.env.REFRESH_TTL || '30d';          // e.g. 30d
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

const COOKIE_NAME = process.env.COOKIE_NAME || 'mc_token';
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'mc_refresh';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

function parseDurToSec(s) {
  // supports "15m", "30d", "12h", "3600" (seconds)
  if (!isNaN(Number(s))) return Number(s);
  const m = String(s).match(/^(\d+)([smhd])$/i);
  if (!m) return 3600;
  const n = Number(m[1]); const u = m[2].toLowerCase();
  return u === 's' ? n : u === 'm' ? n * 60 : u === 'h' ? n * 3600 : n * 86400;
}
const REFRESH_TTL_SEC = parseDurToSec(REFRESH_TTL);
const ACCESS_TTL_SEC  = parseDurToSec(ACCESS_TTL);

function setTokenCookies(res, { accessToken, refreshToken }) {
  const base = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    domain: COOKIE_DOMAIN,
    path: '/',
  };
  res.cookie(COOKIE_NAME, accessToken, { ...base, maxAge: ACCESS_TTL_SEC * 1000 });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...base, maxAge: REFRESH_TTL_SEC * 1000 });
  }
}

function clearAuthCookies(res) {
  const base = { httpOnly: true, secure: COOKIE_SECURE, sameSite: COOKIE_SAMESITE, domain: COOKIE_DOMAIN, path: '/' };
  res.clearCookie(COOKIE_NAME, base);
  res.clearCookie(REFRESH_COOKIE_NAME, base);
}

// ========= NEW HANDLERS ==========

/** POST /auth/refresh
 * Rotates refresh token (cookie) and returns a fresh access token (also cookie).
 * Protect this route with CSRF (since it’s cookie-based).
 */
export async function refresh(req, res) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET); // { sub, jti }
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const sess = await validateSession(payload.jti);
    if (!sess || sess.userId !== payload.sub) {
      return res.status(401).json({ success: false, message: 'Refresh session not found' });
    }

    // rotate
    const newJti = await rotateSession(
      payload.jti,
      payload.sub,
      REFRESH_TTL_SEC,
      { ua: (req.headers['user-agent'] || '').slice(0, 128), ip: req.ip }
    );

    const accessToken = jwt.sign({ sub: payload.sub }, JWT_SECRET, { expiresIn: ACCESS_TTL });
    const newRefresh  = jwt.sign({ sub: payload.sub, jti: newJti }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

    setTokenCookies(res, { accessToken, refreshToken: newRefresh });
    return res.json({ success: true, accessToken }); // token also set in cookie
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Refresh failed' });
  }
}

/** POST /auth/logout-everywhere
 * Requires normal auth (req.user from requireAuth).
 * Revokes all refresh sessions for the user and clears cookies.
 */
export async function logoutEverywhere(req, res) {
  try {
    const userId = (req.user?.id || req.user?._id || '').toString();
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    await revokeAllUserSessions(userId);
    clearAuthCookies(res);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: 'Logout failed' });
  }
}

// ========= OPTIONAL helpers you can reuse in signup/login =========

export async function issueSessionCookiesForUser(res, userId, req) {
  const jti = await createSession(userId, REFRESH_TTL_SEC, {
    ua: (req.headers['user-agent'] || '').slice(0, 128),
    ip: req.ip,
  });

  const accessToken  = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign({ sub: userId, jti }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

  setTokenCookies(res, { accessToken, refreshToken });
  return { accessToken, refreshToken };
}

