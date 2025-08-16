// controllers/authController.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const {
  NODE_ENV = 'development',
  JWT_SECRET = 'change-me',
  JWT_EXPIRES_IN = '15m',
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN = '7d',
  ACCESS_COOKIE_NAME = 'mc_token',
  REFRESH_COOKIE_NAME = 'rt',
  COOKIE_DOMAIN,
} = process.env;

const isProd = NODE_ENV === 'production';
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublicUser(u) {
  if (!u) return null;
  const o = u.toObject ? u.toObject() : u;
  return {
    _id: o._id,
    email: o.email,
    name: o.name ?? o.displayName ?? '',
    role: o.role ?? 'user',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function signRefreshToken(userId) {
  const key = REFRESH_TOKEN_SECRET || JWT_SECRET;
  return jwt.sign({ sub: String(userId), type: 'refresh' }, key, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'none',
    path: '/',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
  res.cookie(ACCESS_COOKIE_NAME, accessToken, base);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, base);
}
function clearAuthCookies(res) {
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'none',
    path: '/',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
  res.clearCookie(ACCESS_COOKIE_NAME, base);
  res.clearCookie(REFRESH_COOKIE_NAME, base);
}
function getTokenFromReq(req) {
  const auth = req.headers?.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.cookies?.[ACCESS_COOKIE_NAME];
}

/* ----------------------------- Controllers ----------------------------- */

export async function signup(req, res) {
  try {
    const { name = '', email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password required' });
    }
    if (!emailRe.test(email) || String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid signup payload' });
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await User.create({ name, email, password: hash });

    const accessToken = signAccessToken(created._id);
    const refreshToken = signRefreshToken(created._id);
    setAuthCookies(res, { accessToken, refreshToken });

    return res.status(201).json({
      success: true,
      user: toPublicUser(created),
      token: accessToken, // legacy
      accessToken,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Signup failed', details: String(err?.message || err) });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password required' });
    }

    const userDoc = await User.findOne({ email }).select('+password');
    if (!userDoc) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, userDoc.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const accessToken = signAccessToken(userDoc._id);
    const refreshToken = signRefreshToken(userDoc._id);
    setAuthCookies(res, { accessToken, refreshToken });

    return res.json({
      success: true,
      user: toPublicUser(userDoc),
      token: accessToken, // legacy
      accessToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Login failed', details: String(err?.message || err) });
  }
}

export async function me(req, res) {
  try {
    if (req.user) return res.json({ success: true, user: toPublicUser(req.user) });

    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ success: false, user: null });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, user: null });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, user: null });

    return res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch current user' });
  }
}

export async function logout(_req, res) {
  try {
    clearAuthCookies(res);
    return res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, message: 'Logout failed' });
  }
}
