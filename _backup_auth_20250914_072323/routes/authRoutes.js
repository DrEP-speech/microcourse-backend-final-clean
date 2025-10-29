// routes/authRoutes.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const r = Router();
const isProd = process.env.NODE_ENV === 'production';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');

router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);        // accepts cookie or header
router.post('/logout', ctrl.logout);          // clears cookie + blacklist
router.get('/me', ctrl.requireAuth, ctrl.me); // access-token protected

module.exports = router;

// ---- Config / Secrets ----
const ACCESS_SECRET   = process.env.JWT_SECRET;
const REFRESH_SECRET  = process.env.REFRESH_SECRET || ACCESS_SECRET;
const ACCESS_TTL  = 15 * 60;               // 15 min
const REFRESH_TTL = 7 * 24 * 60 * 60;      // 7 days

if (!ACCESS_SECRET) {
  console.warn('[auth] JWT_SECRET is not set – tokens cannot be created/verified');
}

// ---- Cookie settings (for browsers) ----
const refreshCookieName = 'refresh';      // canonical cookie name
const legacyCookieName  = 'refreshToken'; // we will also read/clear this if present
const refreshCookieOpts = {
  httpOnly: true,
  secure: true,           // Render/Vercel are HTTPS
  sameSite: 'none',       // cross-site frontends
  path: '/api/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
};

// ---- Helpers ----
const normEmail = (e) => (e || '').trim().toLowerCase();

function signAccess(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role || 'user' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

function signRefresh(user) {
  return jwt.sign({ sub: user._id.toString() }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

// Bearer middleware for protected routes
export function authBearer(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Missing bearer token' });
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// ---- Routes ----

// POST /api/auth/signup
r.post('/refresh', async (req, res) => {
    if (!ACCESS_SECRET) {
      return res.status(500).json({ success: false, message: 'JWT secret missing' });
    }

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

    const token = signAccess(user);

    // set refresh cookie for browsers, but don't fail if it errors
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

// POST /api/auth/login
r.post('/login', async (req, res) => {
  try {
    if (!ACCESS_SECRET) {
      return res.status(500).json({ success: false, message: 'JWT secret missing' });
    }

    const email = normEmail(req.body?.email);
    const password = (req.body?.password || '').trim();
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signAccess(user);

    // set refresh cookie (browser flow)
    try {
      const refresh = signRefresh(user);
      res.cookie(refreshCookieName, refresh, refreshCookieOpts);
    } catch (e) {
      console.error('SET_REFRESH_COOKIE_FAILED', e);
      // still return access token for script/CLI clients
    }

    return res.json({ success: true, token });
  } catch (err) {
    console.error('LOGIN_FAILED', err);
    const message = isProd ? 'Internal Server Error' : (err.message || String(err));
    return res.status(500).json({ success: false, message });
  }
});

// GET /api/auth/me
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

// POST /api/auth/refresh
// Accepts refresh from: cookie ("refresh" or legacy "refreshToken"), header "Refresh", or JSON body { refresh }
r.post('/refresh', async (req, res) => {
  try {
    // 1) Look for cookie first (browser flow)
    const cookieToken =
      req.cookies?.[refreshCookieName] ||
      req.cookies?.[legacyCookieName];

    // 2) Fallbacks for CLI/scripting
    const headerToken = req.get('Refresh');         // custom header
    const bodyToken   = req.body?.refresh;          // JSON field

   const raw = req.cookies?.refresh || req.get('Refresh');
  if (!raw) return res.status(401).json({ success: false, message: 'Missing refresh token' });

  try {
    const payload = jwt.verify(raw, REFRESH_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const access  = makeAccess(user);
    const refresh = makeRefresh(user);
    setRefreshCookie(res, refresh);

    return res.json({ success: true, token: access });
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

export default r;

    let payload;
    try {
      payload = jwt.verify(raw, REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid refresh token' });

    // Rotate refresh (browser flow only). If the original came via header/body, we still set cookie for browsers,
    // but scripts can ignore cookies and just read the returned access token.
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

// POST /api/auth/logout
r.post('/logout', (req, res) => {
  try {
    const base = { ...refreshCookieOpts, maxAge: 0 };
    res.cookie(refreshCookieName, '', base);
    res.cookie(legacyCookieName,  '', base); // clear legacy too
    return res.json({ success: true });
  } catch (err) {
    console.error('LOGOUT_FAILED', err);
    return res.status(500).json({ success: false, message: isProd ? 'Internal Server Error' : err.message });
  }
});

export default r;
