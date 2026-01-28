"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const router = express.Router();

/** Sign a short-lived JWT */
function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret not configured");
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: "1h" });
}

/** Require a valid Bearer token; attach payload to req.auth */
function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const parts = hdr.split(" ");
    const token = parts.length === 2 ? parts[1] : null;
    if (!token) return res.status(401).json({ success: false, message: "Missing token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    next();
  } catch (_) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password).catch(() => false);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(user);
    return res.json({ success: true, token });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Unexpected error" });
  }
});

router.get("/whoami", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.sub).select("-password");
  return res.json({ success: true, user });
});

/** New: tiny protected probe */
router.get("/ping-protected", requireAuth, (req, res) => {
  return res.json({
    success: true,
    data: {
      ts: new Date().toISOString(),
      user: { id: req.auth.sub, role: req.auth.role }
    }
  });
});

module.exports = router;

