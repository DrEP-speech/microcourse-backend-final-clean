/**
 * middleware/requireAuth.js
 * Bearer token first; cookie fallback.
 */
const jwt = require("jsonwebtoken");

function getToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (auth && typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  // cookie fallback (support multiple common cookie names)
  const c = req.cookies || {};
  return c.token || c.accessToken || c.jwt || null;
}

module.exports = function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "NO_TOKEN" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ ok: false, error: "JWT_SECRET_MISSING" });

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN" });
  }
};