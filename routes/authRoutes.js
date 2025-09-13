// routes/authRoutes.js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const r = Router();

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TTL = '2h';                          // access token lifetime
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;         // 7 days in seconds

// Single, authoritative cookie options object (do not duplicate this)
const cookieOpts = {
  httpOnly: true,
  secure: isProd,                                 // true on Render/Vercel (HTTPS)
  sameSite: isProd ? 'none' : 'lax',              // allow cross-site from Vercel
  path: '/api/auth/refresh',                      // only sent to /refresh
  maxAge: REFRESH_TTL_SEC * 1000,
};

const signAccess = (user) =>
  jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );

const signRefresh = (user) =>
  jwt.sign({ sub: user._id.toString(), type: 'refresh' }, JWT_SECRET, {
    expiresIn: REFRESH_TTL_SEC,
  });

const bearer = (req) => {
  const h = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(h);
  return m && m[1];
};

// POST /api/auth/signup
r.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'email and password required' });
    }
    const norm = email.toLowerCase().trim();
    const exists = await User.findOne({ email: norm });
    if (exists) return res.status(409).json({ success: false, message: 'Email in use' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: norm,
      password: hash,
      name: (name || 'User').trim(),
    });

    const access = signAccess(user);
    const refresh = signRefresh(user);
    res.cookie('refreshToken', refresh, cookieOpts);

    res.status(201).json({
      success: true,
      token: access,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
r.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'email and password required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const access = signAccess(user);
    const refresh = signRefresh(user);
    res.cookie('refreshToken', refresh, cookieOpts);

    res.json({
      success: true,
      token: access,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
r.get('/me', async (req, res) => {
  const token = bearer(req);
  if (!token) return res.status(401).json({ success: false, message: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: { id: user._id, email: user.email, name: user.name } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// POST /api/auth/refresh
r.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'No refresh cookie' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Bad token');
    const user = await User.findById(payload.sub);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const access = signAccess(user);
    const nextRefresh = signRefresh(user);
    res.cookie('refreshToken', nextRefresh, cookieOpts); // rotate
    res.json({ success: true, token: access });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
r.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', { ...cookieOpts, maxAge: 0 });
  res.json({ success: true });
});

export default r;
