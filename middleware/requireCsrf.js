// middleware/requireCsrf.js
export function requireCsrf(req, res, next) {
  const headerToken =
    req.get('X-CSRF-Token') ||
    req.get('x-csrf-token') ||
    req.get('X-Csrf-Token');

  const cookieName = process.env.CSRF_COOKIE_NAME || 'mc_csrf';
  const cookieToken = req.cookies?.[cookieName];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
  }
  next();
}
