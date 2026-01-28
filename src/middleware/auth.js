"use strict";

const jwt = require("jsonwebtoken");

function getTokenFromReq(req) {
  const auth = req.headers.authorization || req.headers.Authorization;

  // Authorization: Bearer <token>
  if (auth && typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) return m[1].trim();

    // Some clients accidentally send raw token in Authorization
    if (auth.trim().length > 20) return auth.trim();
  }

  // Cookie fallbacks (if cookie-parser is used)
  if (req.cookies) {
    return (
      req.cookies.access_token ||
      req.cookies.token ||
      req.cookies.jwt ||
      null
    );
  }

  return null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing token" });
  }

  // Use the SAME secret family across the app
  const secret =
    process.env.JWT_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    "dev_secret";

  try {
    const decoded = jwt.verify(token, secret);

    // Normalize: some payloads use {sub}, some {id}, some embed {user:{}}
    const u = decoded.user ? decoded.user : decoded;

    req.user = {
      id: u.id || u._id || decoded.sub || decoded.id || null,
      email: u.email || decoded.email || null,
      role: u.role || decoded.role || "student",
      raw: decoded,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
