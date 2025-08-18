// controllers/authController.js (ESM)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

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
