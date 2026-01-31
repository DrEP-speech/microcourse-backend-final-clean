const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function register(req, res) {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, message: "email and password required" });

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ ok: false, message: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name: name || "", email: email.toLowerCase(), passwordHash, role: "student" });

  const token = signToken(user);
  return res.status(201).json({ ok: true, token, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, message: "email and password required" });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ ok: false, message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, message: "Invalid credentials" });

  const token = signToken(user);
  return res.status(200).json({ ok: true, token, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
}

async function me(req, res) {
  const id = req.user?.sub;
  const user = await User.findById(id).select("_id email role name");
  if (!user) return res.status(404).json({ ok: false, message: "User not found" });
  return res.status(200).json({ ok: true, user });
}

module.exports = { register, login, me };