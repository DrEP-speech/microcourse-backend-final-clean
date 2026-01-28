const jwt = require("jsonwebtoken");

/**
 * Minimal auth shim:
 * - accepts req.user if your existing auth has already populated it
 * - else checks cookies: token|jwt|auth_token
 * - else checks Authorization: Bearer <token>
 */
module.exports = function requireUser(req, res, next) {
  try {
    if (req.user && req.user._id) return next();

    const cookieToken =
      (req.cookies && (req.cookies.token || req.cookies.jwt || req.cookies.auth_token)) || null;

    const header = req.headers.authorization || "";
    const bearerToken = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : null;

    const token = cookieToken || bearerToken;
    if (!token) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);

    // Normalize user shape
    req.user = {
      _id: decoded.id || decoded._id || decoded.userId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    if (!req.user._id) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Unauthorized", error: err.message });
  }
};
