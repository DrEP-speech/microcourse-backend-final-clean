import crypto from 'crypto';

export function issueCsrf(req, res) {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie('mc_csrf', token, {
    httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/'
  });
  res.json({ csrfToken: token });
}

export function requireCsrf(req, res, next) {
  const cookie = req.cookies?.mc_csrf;
  const header = req.get('X-CSRF-Token');
  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ success: false, message: 'CSRF check failed' });
  }
  next();
}
