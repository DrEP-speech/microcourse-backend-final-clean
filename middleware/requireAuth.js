const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.requireAuth = async (req, res, next) => {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const secret = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select("_id email role");
    if (!user) return res.status(401).json({ ok: false, error: "Invalid token" });

    req.user = { id: user._id.toString(), email: user.email, role: user.role };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
};
