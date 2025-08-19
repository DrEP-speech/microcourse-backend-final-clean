// middleware/requireCsrf.js
import crypto from 'node:crypto';

const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME || 'mc_csrf';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

/** GET /auth/csrf — issue a token cookie and return the token in JSON */
export function issueCsrf(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,              // readable by client (double-submit cookie pattern)
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: 60 * 60 * 1000,       // 1 hour
  });
  res.json({ csrfToken: token });
}

/** For unsafe methods, require X-CSRF-Token to equal the cookie value */
export function requireCsrf(req, res, next) {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

  const headerToken = req.get('X-CSRF-Token') || '';
  const cookieToken = req.cookies?.[CSRF_COOKIE] || '';
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
  }
  next();
}
