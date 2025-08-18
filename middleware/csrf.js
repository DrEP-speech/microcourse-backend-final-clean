import crypto from 'crypto';

export function csrfToken() {
  return (req, res) => {
    const token = crypto.randomBytes(24).toString('base64url');
    res.cookie('csrf', token, { httpOnly: false, sameSite: 'none', secure: process.env.NODE_ENV === 'production', path: '/' });
    res.json({ csrfToken: token });
  };
}

export function requireCsrf(req, res, next) {
  const cookie = req.cookies?.csrf;
  const header = req.get('X-CSRF-Token');
  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ success: false, message: 'CSRF token missing/invalid' });
  }
  next();
}
