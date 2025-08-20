// middleware/requireCsrf.js
// Simple CSRF check: the header X-CSRF-Token must equal the csrfToken cookie.
// We only enforce on "unsafe" methods (POST/PUT/PATCH/DELETE), but you can
// still mount it per-route like you’re doing now.

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requireCsrf(req, res, next) {
  if (!UNSAFE.has(req.method)) return next();

  const headerToken = req.get('X-CSRF-Token');
  const cookieToken = req.cookies?.csrfToken;

  if (!cookieToken || !headerToken || headerToken !== cookieToken) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing CSRF token',
    });
  }
  return next();
}
