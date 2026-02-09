const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function cookieOptions() {
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const sameSite = isProd ? "none" : "lax";
  const secure = isProd ? true : false;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    // 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function signToken(user) {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || "dev_secret_change_me";
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
    secret,
    { expiresIn: "7d" }
  );
}

async function register(req, res) {
  try {
    const { email, password, name, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "email and password required" });

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) return res.status(409).json({ ok: false, error: "email already in use" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      email: String(email).toLowerCase().trim(),
      passwordHash,
      name: name ? String(name) : "",
      role: role ? String(role) : "student"
    });

    const token = signToken(user);
    res.cookie("token", token, cookieOptions());
    return res.json({ ok: true, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "register failed", detail: String(err.message || err) });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "email and password required" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ ok: false, error: "invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid credentials" });

    const token = signToken(user);
    res.cookie("token", token, cookieOptions());
    return res.json({ ok: true, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "login failed", detail: String(err.message || err) });
  }
}

function logout(_req, res) {
  res.clearCookie("token", { path: "/" });
  res.clearCookie("mc_token", { path: "/" });
  return res.json({ ok: true });
}

function me(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
  return res.json({ ok: true, user: req.user });
}

module.exports = { register, login, logout, me,
  login: notImplemented("login"),
  logout: notImplemented("logout"),
  me: notImplemented("me"),
  register: notImplemented("register"),
 };