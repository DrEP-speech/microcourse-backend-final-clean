"use strict";
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret not configured");
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: "1h" });
}

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: "Email & password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = signToken(user);
    return res.json({ success: true, token });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ success: false, message: "Unexpected error" });
  }
});

router.get("/whoami", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const [, raw] = header.split(" ");
    if (!raw) return res.status(401).json({ success: false, message: "Missing token" });

    const payload = jwt.verify(raw, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
});

module.exports = router;
