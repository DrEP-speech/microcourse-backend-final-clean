// controllers/authController.js
// ESM (Node 18/20+). Uses Redis-backed refresh sessions.

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js'; // <-- Ensure this path matches your project
import {
  createSession,
  validateSession,
  rotateSession,
  revokeAllUserSessions,
} from '../services/tokenStore.js';

/* ========================= CONFIG ========================= */

const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.REFRESH_TTL || '30d';

const JWT_SECRET = process.env.JWT_SECRET; // required
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

export function clearAuthCookies(res) {
  const base = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    domain: COOKIE_DOMAIN,
    path: '/',
  };
  res.clearCookie(COOKIE_NAME, base);
  res.clearCookie(REFRESH_COOKIE_NAME, base);
}

/**
 * Create a Redis refresh session + set cookies for access & refresh
 * Returns { accessToken, refreshToken } (if you also want to send JSON tokens)
 */
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

/* ========================= HANDLERS ========================= */

/** POST /auth/signup  (CSRF-protected; public) */
export async function signup(req, res) {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Invalid signup payload' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already in use' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hash,
    role: 'student',
  });

  // 🔑 One-line change (this replaces old cookie-setting logic)
  await issueSessionCookiesForUser(res, user._id.toString(), req);

  return res.status(201).json({
    success: true,
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    // Optional: keep "token" for legacy clients; cookie is the source of truth
  });
}

/** POST /auth/login  (CSRF-protected; public) */
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Invalid login payload' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.password || '');
  if (!ok) {
    return res.status(400).json({ success: false, message: 'Invalid credentials' });
  }

  // 🔑 One-line change (this replaces old cookie-setting logic)
  await issueSessionCookiesForUser(res, user._id.toString(), req);

  return res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}

/** GET /auth/me  (requireAuth) */
export async function me(req, res) {
  // requireAuth should set req.user = { id, ... } or similar
  const id = (req.user?.id || req.user?._id || '').toString();
  if (!id) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const user = await User.findById(id).select('_id email name role createdAt updatedAt');
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  return res.json({ success: true, user });
}

/** POST /auth/refresh  (CSRF + mc_refresh cookie) */
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

    // rotate session
    const newJti = await rotateSession(
      payload.jti,
      payload.sub,
      REFRESH_TTL_SEC,
      { ua: (req.headers['user-agent'] || '').slice(0, 128), ip: req.ip }
    );

    // reissue tokens
    const accessToken = jwt.sign({ sub: payload.sub }, JWT_SECRET, { expiresIn: ACCESS_TTL });
    const newRefresh  = jwt.sign({ sub: payload.sub, jti: newJti }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

    // set cookies
    setTokenCookies(res, { accessToken, refreshToken: newRefresh });

    return res.json({ success: true, accessToken });
  } catch {
    return res.status(500).json({ success: false, message: 'Refresh failed' });
  }
}

/** POST /auth/logout-everywhere (auth + CSRF) */
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
