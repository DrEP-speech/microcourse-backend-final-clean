module.exports = function requireRole(...allowedRoles) {
  return function (req, res, next) {
    try {
      const role = req.user && req.user.role;
      if (!role) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      return next();
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  };
};