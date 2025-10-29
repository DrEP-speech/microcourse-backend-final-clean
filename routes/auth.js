"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");

// ---- configuration (env with sensible fallbacks) ----
const JWT_SECRET  = process.env.JWT_SECRET  || "dev-secret-change-me";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "1h";
const MAX_FAILED  = Number(process.env.AUTH_MAX_FAILED ?? 5);
const LOCK_MS     = Number(process.env.AUTH_LOCK_MS   ?? 10 * 60 * 1000); // 10m

// ---- helpers ----
const sign = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

const requireAuth = async (req, res, next) => {
  try {
    const hdr = req.get("authorization") || "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ success: false, message: "Missing bearer token" });

    const payload = jwt.verify(m[1], JWT_SECRET);
    const me = await User.findById(payload.sub).exec();
    if (!me || me.status !== "active")
      return res.status(401).json({ success: false, message: "Invalid token" });

    req.user = me;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ---- request validators (Zod) ----
const registerBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(200),
  role: z.enum(["owner", "admin", "user"]).optional(),
});

const loginBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(200),
});

// ---- router ----
const router = express.Router();

/**
 * POST /register
 * Creates a user (idempotent on email). Returns sanitized user + token.
 * In production you may want to gate "owner" creation to the first seed only.
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = registerBody.parse(req.body);

    const existing = await User.findOne({ email }).select("+passwordHash").exec();
    if (existing) {
      // If user exists, just say it's created and offer login guidance (non-disclosing)
      return res.status(200).json({ success: true, message: "Account exists. Please login." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      passwordHash,
      role: role ?? "user",
      status: "active",
    });

    const token = sign(user);
    return res.status(201).json({ success: true, user: user.publicView(), token });
  } catch (err) {
    if (err?.issues) {
      return res.status(400).json({ success: false, message: "Invalid input", issues: err.issues });
    }
    return res.status(500).json({ success: false, message: "Register failed" });
  }
});

/**
 * POST /login
 * - Validates body
 * - Enforces lockout window
 * - Resets failure counter on success
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginBody.parse(req.body);

    const user = await User.findOne({ email }).select("+passwordHash").exec();
    if (!user || user.status !== "active") {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // lockout check
    if (user.lockUntil && user.lockUntil > new Date()) {
      const ms = user.lockUntil.getTime() - Date.now();
      return res.status(423).json({ success: false, message: `Account locked. Try again in ${Math.ceil(ms/1000)}s` });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      user.failedLogins = (user.failedLogins ?? 0) + 1;
      if (user.failedLogins >= MAX_FAILED) {
        user.lockUntil = new Date(Date.now() + LOCK_MS);
        user.failedLogins = 0; // reset after lock
      }
      await user.save();
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // success
    user.failedLogins = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const token = sign(user);
    return res.json({ success: true, token, user: user.publicView(), expiresIn: JWT_EXPIRES });
  } catch (err) {
    if (err?.issues) {
      return res.status(400).json({ success: false, message: "Invalid input", issues: err.issues });
    }
    return res.status(500).json({ success: false, message: "Login failed" });
  }
});

/**
 * GET /whoami (requires bearer)
 * Returns the current user public view.
 */
router.get("/whoami", requireAuth, async (req, res) => {
  return res.json({ success: true, user: req.user.publicView() });
});

module.exports = router;
