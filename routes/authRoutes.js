// routes/authRoutes.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const r = Router();
const isProd = process.env.NODE_ENV === 'production';

const ACCESS_TTL  = process.env.JWT_EXPIRES_IN   || '15m';
const REFRESH_TTL = process.env.REFRESH_EXPIRES_IN || '7d';
const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || ACCESS_SECRET;

if (!ACCESS_SECRET) {
  console.warn('[auth] JWT_SECRET is not set – tokens cannot be created/verified');
}

/** Single, reusable cookie options (must match on clear) */
const refreshCookieName = 'refresh';
const refreshCookieOpts = {
  httpOnly: true,
  secure: true,           // Render/Vercel are HTTPS
  sameSite: 'none',       // needed for cross-site frontends
  path: '/api/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/** Helpers */
const normEmail = (e) => (e || '').trim().toLowerCase();

function signAccess(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role || 'user' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}
function signRefresh(user) {
  return jwt.sign({ sub: user._id.toString() }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

/** Bearer auth middleware (exported) */
export function authBearer(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Missing bearer token' });
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/** POST /signup */
r.post('/signup', async (req, res) => {
  try {
    if (!ACCESS_SECRET) return res.status(500).json({ success: false, message: 'JWT secret missing' });

    const email = normEmail(req.body?.email);
    const password = (req.body?.password || '').trim();
    const name = (req.body?.name || '').trim();

    if (!email || !password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ success: false, message: 'User already exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash: hash, name });

    // tokens
    const token = signAccess(user);
    try {
      const refresh = signRefresh(user);
      res.cookie(refreshCookieName, refresh, refreshCookieOpts);
    } catch (e) {
      console.error('SET_REFRESH_COOKIE_FAILED', e);
    }

    return res.status(201).json({ success: true, token });
  } catch (err) {
    console.error('SIGNUP_FAILED', err);
    const message = isProd ? 'Internal Server Error' : (err.message || String(err));
    return res.status(500).json({ success: false, message });
  }
});

/** POST /login */
r.post('/login', async (req, res) => {
  try {
    if (!ACCESS_SECRET) return res.status(500).json({ success: false, message: 'JWT secret missing' });

    const email = normEmail(req.body?.email);
    const password = (req.body?.password || '').trim();
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signAccess(user);
    try {
      const refresh = signRefresh(user);
      res.cookie(refreshCookieName, refresh, refreshCookieOpts);
    } catch (e) {
      console.error('SET_REFRESH_COOKIE_FAILED', e);
      // continue; we still return the access token
    }

    return res.json({ success: true, token });
  } catch (err) {
    console.error('LOGIN_FAILED', err);
    const message = isProd ? 'Internal Server Error' : (err.message || String(err));
    return res.status(500).json({ success: false, message });
  }
});

/** GET /me (bearer) */
r.get('/me', authBearer, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { _id, email, name, role, createdAt, updatedAt } = user;
    return res.json({
      success: true,
      user: { id: _id.toString(), email, name, role: role || 'user', createdAt, updatedAt },
    });
  } catch (err) {
    console.error('ME_FAILED', err);
    return res.status(500).json({ success: false, message: isProd ? 'Internal Server Error' : err.message });
  }
});

/** POST /refresh – uses refresh cookie, returns a new access token */
r.post('/refresh', async (req, res) => {
  try {
    const cookie = req.cookies?.[refreshCookieName];
    if (!cookie) return res.status(401).json({ success: false, message: 'No refresh cookie' });

    let payload;
    try {
      payload = jwt.verify(cookie, REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid refresh token' });

    // rotate refresh (optional but recommended)
    try {
      const newRefresh = signRefresh(user);
      res.cookie(refreshCookieName, newRefresh, refreshCookieOpts);
    } catch (e) {
      console.error('ROTATE_REFRESH_COOKIE_FAILED', e);
    }

    const token = signAccess(user);
    return res.json({ success: true, token });
  } catch (err) {
    console.error('REFRESH_FAILED', err);
    return res.status(500).json({ success: false, message: isProd ? 'Internal Server Error' : err.message });
  }
});

/** POST /logout – clear the refresh cookie */
r.post('/logout', (req, res) => {
  try {
    res.cookie(refreshCookieName, '', { ...refreshCookieOpts, maxAge: 0 });
    return res.json({ success: true });
  } catch (err) {
    console.error('LOGOUT_FAILED', err);
    return res.status(500).json({ success: false, message: isProd ? 'Internal Server Error' : err.message });
  }
});

export default r;

