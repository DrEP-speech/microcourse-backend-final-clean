// middleware/requireAuth.js
const jwt = require('jsonwebtoken');

const {
  JWT_SECRET = '',
  ACCESS_COOKIE_NAME = 'mc_token',
  NODE_ENV = 'development',
} = process.env;

function getToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (h && typeof h === 'string') {
    const [type, token] = h.split(' ');
    if (/^Bearer$/i.test(type) && token) return token;
  }
  return req.cookies?.[ACCESS_COOKIE_NAME] || null;
}

/**
 * requireAuth({ roles?: string[] })
 * Example: router.get('/admin', requireAuth({ roles: ['admin'] }), handler)
 */
function requireAuth(opts = {}) {
  const roles = Array.isArray(opts.roles) ? opts.roles : null;

  return (req, res, next) => {
    try {
      const token = getToken(req);
      if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const payload = jwt.verify(token, JWT_SECRET);
      req.user = { id: payload.sub, ...payload };

      if (roles && roles.length > 0) {
        const userRole = req.user.role || req.user.claims?.role;
        if (!roles.includes(userRole)) {
          return res.status(403).json({ success: false, message: 'Forbidden' });
        }
      }

      return next();
    } catch (err) {
      const code = err?.name === 'TokenExpiredError' ? 401 : 401;
      return res.status(code).json({ success: false, message: 'Unauthorized' });
    }
  };
}

module.exports = { requireAuth };
