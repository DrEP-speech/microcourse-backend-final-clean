const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");
    req.user = decoded;
    return next();
  } catch (e) {
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
