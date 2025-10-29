// routes/authRoutes.js  (ESM, minimal to prove mount)
import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Simple CSRF (double-submit cookie)
router.get('/csrf', (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie('csrfToken', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12
  });
  res.setHeader('x-csrf-token', token);
  res.json({ token, ok: true });
});

// Fake login that returns a dummy token so we can test flow
router.post('/login', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: 'email required' });
  return res.json({ token: 'dummy.jwt.token', ok: true });
});

// Protected “me” (no real JWT yet; just to prove the route is there)
router.get('/me', (req, res) => {
  return res.json({ ok: true, user: { id: '123', email: 'owner@example.com' } });
});

// Debug echo
router.post('/_debug/echo', (req, res) => res.json({ ok: true, body: req.body ?? null }));

export default router;
