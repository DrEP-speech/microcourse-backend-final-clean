import crypto from 'crypto';

export function issueCsrf(req, res) {
  const token = crypto.randomBytes(24).toString('hex');

  // double-submit cookie
  res.cookie('csrfToken', token, {
    httpOnly: false,                   // header must be readable client-side
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12,
  });

  res.setHeader('x-csrf-token', token);
  res.json({ token });
}

export function requireCsrf(req, res, next) {
  const cookie = req.cookies?.csrfToken;
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
  }
  next();
}
