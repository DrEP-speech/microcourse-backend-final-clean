"use strict";
const express = require("express");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const { signAccessToken, signRefreshToken, verifyRefresh, setRefreshCookie } = require("../utils/tokens");

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });

router.post(
  "/login",
  loginLimiter,
  body("email").isEmail().withMessage("valid email required"),
  body("password").isLength({ min: 6 }).withMessage("password required"),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if(!errors.isEmpty()) return res.status(400).json({ success:false, errors: errors.array() });

      const { email, password } = req.body;
      const user = await User.findByEmailWithPassword(email);
      if(!user) return res.status(401).json({ success:false, message:"Invalid credentials" });

      const ok = await user.comparePassword(password);
      if(!ok) return res.status(401).json({ success:false, message:"Invalid credentials" });

      const token = signAccessToken(user);
      const refresh = signRefreshToken(user);
      setRefreshCookie(res, refresh);

      res.json({ success:true, token, user: { _id:user._id, email:user.email, role:user.role, profile:user.profile } });
    } catch (err) { next(err); }
  }
);

router.get("/whoami", requireAuth, (req, res) => res.json({ success:true, auth:req.auth }));

router.get("/admin/ping", requireAuth, requireRole("owner","admin"), (req, res) => {
  res.json({ success:true, ts:new Date().toISOString(), role:req.auth.role });
});

router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if(!token) return res.status(401).json({ success:false, message:"No refresh token" });
    const payload = verifyRefresh(token);
    const user = await User.findById(payload.sub).select("email role");
    if(!user) return res.status(401).json({ success:false, message:"User not found" });
    res.json({ success:true, token: signAccessToken(user) });
  } catch {
    res.status(401).json({ success:false, message:"Invalid refresh token" });
  }
});

module.exports = router;
