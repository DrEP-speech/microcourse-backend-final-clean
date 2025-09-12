// routes/authRoutes.js
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { signAccess, signRefresh, verifyToken } from '../utils/jwt.js';
import { sendResetEmail } from '../email/mailer.js';

const r = Router();

// cookie helpers
httpOnly: true,
secure: true,
sameSite: 'none',          // <— needed for cross-site XHR from localhost:5173
path: '/api/auth/refresh', // scope to refresh endpoint
maxAge: 1000 * 60 * 60 * 24 * 30
};
};

// ---- signup/login (unchanged core, but add refresh cookie) ----
r.post('/signup', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ success:false, message:'email & password required' });

  const exists = await User.findOne({ email: email.toLowerCase() }).select('_id');
  if (exists) return res.status(409).json({ success:false, message:'User exists' });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase(), password: hash, name, role:'user' });

  const access = signAccess(user);
  const tokenId = crypto.randomUUID();
  const refresh = signRefresh(user, tokenId);
  await RefreshToken.create({
    user: user._id, tokenId,
    expiresAt: new Date(Date.now() + 1000*60*60*24*30),
    meta: { ip:req.ip, ua:req.headers['user-agent'] }
  });

  res.cookie('rt', refresh, cookieOpts);
  res.status(201).json({ success:true, token: access });
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: (email||'').toLowerCase() });
  if (!user) return res.status(403).json({ success:false, message:'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password || '');
  if (!ok)  return res.status(403).json({ success:false, message:'Invalid credentials' });

  const access = signAccess(user);
  const tokenId = crypto.randomUUID();
  const refresh = signRefresh(user, tokenId);
  await RefreshToken.create({
    user: user._id, tokenId,
    expiresAt: new Date(Date.now() + 1000*60*60*24*30),
    meta: { ip:req.ip, ua:req.headers['user-agent'] }
  });

  res.cookie('rt', refresh, cookieOpts);
  res.json({ success:true, token: access });
});

r.post('/logout', async (req, res) => {
  const rt = req.cookies?.rt;
  if (rt) {
    try {
      const p = verifyToken(rt);
      await RefreshToken.updateOne({ tokenId: p.tid }, { $set: { revokedAt: new Date() } });
    } catch {}
  }
  res.cookie('rt', '', clearCookie);
  res.json({ success:true });
});

// ---- refresh with rotation ----
r.post('/refresh', async (req, res) => {
  const rt = req.cookies?.rt;
  if (!rt) return res.status(401).json({ success:false, message:'No refresh cookie' });
  try {
    const p = verifyToken(rt); // { sub, tid }
    const doc = await RefreshToken.findOne({ tokenId: p.tid, user: p.sub, revokedAt: { $exists:false } });
    if (!doc) return res.status(401).json({ success:false, message:'Refresh invalid' });

    // rotate
    const user = await User.findById(p.sub).select('_id role');
    if (!user) return res.status(401).json({ success:false, message:'User missing' });

    await RefreshToken.updateOne({ _id: doc._id }, { $set: { revokedAt: new Date() } });
    const newTid = crypto.randomUUID();
    const newRt  = signRefresh(user, newTid);
    await RefreshToken.create({ user: user._id, tokenId: newTid, expiresAt: new Date(Date.now()+1000*60*60*24*30) });

    res.cookie('rt', newRt, cookieOpts);
    res.json({ success:true, token: signAccess(user) });
  } catch {
    res.cookie('rt', '', clearCookie);
    return res.status(401).json({ success:false, message:'Refresh failed' });
  }
});

// ---- me ----
r.get('/me', async (req, res) => {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)/i);
  if (!m) return res.status(401).json({ success:false, message:'Missing token' });
  try {
    const p = verifyToken(m[1]);
    const u = await User.findById(p.id).select('email name createdAt role');
    if (!u) return res.status(401).json({ success:false, message:'Invalid user' });
    res.json({ success:true, user: { id: u._id, email: u.email, name: u.name, createdAt: u.createdAt, role: u.role } });
  } catch {
    res.status(401).json({ success:false, message:'Invalid token' });
  }
});

// ---- password reset ----
r.post('/request-reset', async (req, res) => {
  const { email } = req.body || {};
  const user = await User.findOne({ email: (email||'').toLowerCase() }).select('_id email');
  if (!user) return res.json({ success:true }); // don't reveal
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = await bcrypt.hash(raw, 10);
  user.resetTokenHash = hash;
  user.resetTokenExp  = new Date(Date.now()+1000*60*30); // 30m
  await user.save();

  const url = `${process.env.FRONTEND_URL || ''}/reset?token=${raw}&u=${user._id}`;
  await sendResetEmail(user.email, url);
  res.json({ success:true });
});

r.post('/confirm-reset', async (req, res) => {
  const { token, userId, password } = req.body || {};
  const user = await User.findById(userId);
  if (!user || !user.resetTokenHash || !user.resetTokenExp) {
    return res.status(400).json({ success:false, message:'Invalid reset' });
  }
  if (user.resetTokenExp.getTime() < Date.now()) {
    return res.status(400).json({ success:false, message:'Token expired' });
  }
  const ok = await bcrypt.compare(token, user.resetTokenHash);
  if (!ok) return res.status(400).json({ success:false, message:'Invalid token' });

  user.password = await bcrypt.hash(password, 10);
  user.resetTokenHash = undefined;
  user.resetTokenExp  = undefined;
  await user.save();
  res.json({ success:true });
});

export default r;

