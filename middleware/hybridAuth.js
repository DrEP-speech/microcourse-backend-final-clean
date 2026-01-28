const jwt = require("jsonwebtoken");

function tryLoadUserModel() {
  try {
    // Common locations in many Node/Express repos:
    return require("../models/User");
  } catch (_) {
    try { return require("../model/User"); } catch (__) {}
    try { return require("../models/user"); } catch (___) {}
    return null;
  }
}

const User = tryLoadUserModel();

function getBearerToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h) return null;
  const s = String(h);
  if (!s.toLowerCase().startsWith("bearer ")) return null;
  return s.slice(7).trim();
}

function getCookieToken(req) {
  // Accept a few common cookie names if you ever set them:
  const c = req.cookies || {};
  return c.token || c.jwt || c.accessToken || c.authToken || null;
}

async function attachUserFromJwt(req, token) {
  const secret = process.env.JWT_SECRET || process.env.SECRET || "dev_secret_change_me";
  const decoded = jwt.verify(token, secret);
  req.jwt = decoded;

  // If your token already includes role/email/etc, you can use it directly.
  // If it only contains an id, we try to hydrate from DB when possible.
  if (User && (decoded.id || decoded._id || decoded.userId)) {
    const id = decoded.id || decoded._id || decoded.userId;
    const user = await User.findById(id).lean();
    if (user) req.user = user;
    else req.user = decoded;
  } else {
    req.user = decoded;
  }
}

function attachUserFromSession(req) {
  // Works with express-session, cookie-session, custom session objects, etc.
  if (req.user) return true;

  const s = req.session || {};
  if (s.user) { req.user = s.user; return true; }
  if (s.passport && s.passport.user) { req.user = s.passport.user; return true; }

  // Some apps store it directly:
  if (req.sessionUser) { req.user = req.sessionUser; return true; }

  return false;
}

module.exports = async function hybridAuth(req, res, next) {
  try {
    // 1) If already authenticated upstream, keep it.
    if (req.user) return next();

    // 2) Try session-based auth
    if (attachUserFromSession(req)) return next();

    // 3) Try JWT (Authorization header)
    const bearer = getBearerToken(req);
    if (bearer) {
      await attachUserFromJwt(req, bearer);
      return next();
    }

    // 4) Try JWT from cookie (optional)
    const cookieTok = getCookieToken(req);
    if (cookieTok) {
      await attachUserFromJwt(req, cookieTok);
      return next();
    }

    return res.status(401).json({ ok: false, message: "Unauthorized" });
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Unauthorized", error: String(err?.message || err) });
  }
};
