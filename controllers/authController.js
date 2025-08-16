/**
 * controllers/authController.js
 *
 * Auth controller that returns JWTs on login/signup and (optionally) sets
 * httpOnly cookies for access/refresh tokens. Includes a robust /me reader
 * that works with either Authorization: Bearer <token> or a mc_token cookie.
 *
 * Response shapes (stable):
 * - 200/201:
 *   { success: true, user: { _id, email, name, role, createdAt, updatedAt }, token?: string, accessToken?: string }
 * - 400/401/409/500:
 *   { success: false, message: string, details?: any }
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ---- Import your User model (adjust path/name as needed) --------------------
let User;
try { User = require('../models/userModel'); } catch (e1) {
  try { User = require('../models/User'); } catch (e2) {
    try { User = require('../models/user'); } catch (e3) {
      throw new Error('User model not found. Adjust import in controllers/authController.js');
    }
  }
}

// ---- Configuration via ENV --------------------------------------------------
const {
  JWT_SECRET = '',
  JWT_EXPIRES_IN = '15m',

  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN = '7d',

  SET_ACCESS_COOKIE = 'false',                 // 'true' to also set access token cookie
  ACCESS_COOKIE_NAME = 'mc_token',            // aligns with your Next.js proxy
  REFRESH_COOKIE_NAME = 'rt',

  COOKIE_DOMAIN,
  NODE_ENV = 'development',
} = process.env;

if (!JWT_SECRET && NODE_ENV === 'production') {
  console.warn('[auth] JWT_SECRET is missing in production!');
}

const REFRESH_SECRET = REFRESH_TOKEN_SECRET || JWT_SECRET;

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax',
  secure: NODE_ENV === 'production',
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

// ---- Helpers ---------------------------------------------------------------

const sanitizeUser = (u) => {
  if (!u) return null;
  return {
    _id: u._id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};

const signAccessToken = (userId) =>
  jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const signRefreshToken = (userId) =>
  jwt.sign({ sub: String(userId) }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  if (String(SET_ACCESS_COOKIE).toLowerCase() === 'true' && accessToken) {
    // Optional cookie for access token (you typically let Next proxy set mc_token)
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      ...baseCookie,
      maxAge: msToNumber(JWT_EXPIRES_IN), // best-effort
    });
  }

  if (refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...baseCookie,
      maxAge: msToNumber(REFRESH_TOKEN_EXPIRES_IN),
    });
  }
};

const clearAuthCookies = (res) => {
  res.cookie(ACCESS_COOKIE_NAME, '', { ...baseCookie, maxAge: 0 });
  res.cookie(REFRESH_COOKIE_NAME, '', { ...baseCookie, maxAge: 0 });
};

const getTokenFromReq = (req) => {
  // Authorization: Bearer <token>
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (h && typeof h === 'string') {
    const parts = h.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1];
    }
  }
  // Fallback to cookie (used by your Next proxy)
  return req.cookies?.[ACCESS_COOKIE_NAME] || null;
};

// Best-effort ms parser for '15m', '7d', etc. (fallback to 1 day)
function msToNumber(expr) {
  if (!expr || typeof expr !== 'string') return 24 * 60 * 60 * 1000;
  const m = expr.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const map = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (map[unit] || 86_400_000);
}

// Basic validators (swap for Zod/Joi if you prefer)
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isNonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

// ---- Controllers -----------------------------------------------------------

/**
 * POST /api/auth/signup
 * body: { name, email, password }
 */
async function signup(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (!isNonEmpty(name) || !isEmail(email) || !isNonEmpty(password)) {
      return res.status(400).json({ success: false, message: 'Invalid signup payload' });
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    // Hash if your model doesn't already hash in a pre-save hook
    let hashed = password;
    if (!User.schema?.paths?.password?.options?.select === false) {
      const salt = await bcrypt.genSalt(10);
      hashed = await bcrypt.hash(password, salt);
    }

    const created = await User.create({ name, email, password: hashed });
    const user = sanitizeUser(created);

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    setAuthCookies(res, { accessToken, refreshToken });

    // Return token fields so the Next.js proxy can set mc_token
    return res.status(201).json({
      success: true,
      user,
      token: accessToken,         // legacy key some clients expect
      accessToken,                // modern explicit key
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: 'Signup failed', details: String(err?.message || err) });
  }
}

/**
 * POST /api/auth/login
 * body: { email, password }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!isEmail(email) || !isNonEmpty(password)) {
      return res.status(400).json({ success: false, message: 'Invalid login payload' });
    }

    // Make sure to select password if your schema uses select:false
    const userDoc = await User.findOne({ email }).select('+password');
    if (!userDoc) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, userDoc.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = sanitizeUser(userDoc);
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    setAuthCookies(res, { accessToken, refreshToken });

    return res.json({
      success: true,
      user,
      token: accessToken,
      accessToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed', details: String(err?.message || err) });
  }
}

/**
 * GET /api/auth/me
 * Reads token from Authorization Bearer or mc_token cookie.
 * If you're using a separate requireAuth middleware, this still works as a fallback.
 */
async function me(req, res) {
  try {
    let userId = req.user?.id || req.user?._id; // if middleware already decoded

    if (!userId) {
      const token = getTokenFromReq(req);
      if (!token) return res.status(401).json({ user: null });

      try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
      } catch (e) {
        return res.status(401).json({ user: null });
      }
    }

    const userDoc = await User.findById(userId).lean();
    if (!userDoc) return res.status(401).json({ user: null });

    return res.json({ user: sanitizeUser(userDoc) });
  } catch (err) {
    console.error('ME error:', err);
    return res.status(500).json({ success: false, message: 'ME failed', details: String(err?.message || err) });
  }
}

/**
 * POST /api/auth/refresh
 * Uses httpOnly refresh cookie to mint a new access token.
 */
async function refresh(req, res) {
  try {
    const rt = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rt) return res.status(401).json({ success: false, message: 'No refresh token' });

    let payload;
    try {
      payload = jwt.verify(rt, REFRESH_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const userDoc = await User.findById(payload.sub).lean();
    if (!userDoc) return res.status(401).json({ success: false, message: 'User not found' });

    const accessToken = signAccessToken(userDoc._id);
    setAuthCookies(res, { accessToken, refreshToken: null });

    return res.json({
      success: true,
      accessToken,
      token: accessToken,
      user: sanitizeUser(userDoc),
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ success: false, message: 'Refresh failed', details: String(err?.message || err) });
  }
}

/**
 * POST /api/auth/logout
 * Clears auth cookies. (Clients should also forget any in-memory tokens.)
 */
async function logout(req, res) {
  try {
    clearAuthCookies(res);
    return res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, message: 'Logout failed', details: String(err?.message || err) });
  }
}

module.exports = {
  signup,
  login,
  me,
  refresh,
  logout,
};
