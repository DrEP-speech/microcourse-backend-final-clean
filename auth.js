"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const router = express.Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret not configured");
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: "1h" });
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: "email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "invalid credentials" });

    const token = signToken(user);
    res.json({ success: true, token, user: user.toJSON() });
  } catch (err) {
    console.error("[auth.login]", err);
    res.status(500).json({ success: false, message: "Unexpected error" });
  }
});

router.get("/whoami", (req, res) => {
  try {
    const hdr = req.headers.authorization || "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ success: false, message: "Missing token" });

    const token = m[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, user: { id: payload.sub, role: payload.role } });
  } catch (err) {
    console.error("[auth.whoami]", err);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

module.exports = router;
