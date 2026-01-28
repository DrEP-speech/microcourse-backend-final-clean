const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  try {
    const header = req.headers["authorization"] || "";
    const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;

    const token =
      bearer ||
      req.headers["x-access-token"] ||
      req.headers["x-auth-token"] ||
      req.headers["token"] ||
      null;

    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const secret = process.env.JWT_SECRET || process.env.JWT_KEY || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
};