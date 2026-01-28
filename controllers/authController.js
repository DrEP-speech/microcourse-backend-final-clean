const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "email and password required" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).lean();
    if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "student" },
      secret,
      { expiresIn: "7d" }
    );

    return res.json({
      ok: true,
      token,
      user: { id: user._id, email: user.email, role: user.role || "student", name: user.name || "" }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    return res.json({ ok: true, user: req.user });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

exports.register = async (req, res) => {
  return res.status(501).json({ ok: false, error: "register not implemented yet" });
};
exports.logout = async (req, res) => {
  return res.json({ ok: true });
};