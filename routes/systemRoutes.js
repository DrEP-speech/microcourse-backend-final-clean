const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth"); // adjust path if different


router.get("/__whoami", requireAuth, (req, res) => {
  // requireAuth should attach something like req.user
  const u = req.user || {};
  res.status(200).json({
    ok: true,
    user: {
      id: u.id || u._id || null,
      email: u.email || null,
      role: u.role || null,
      name: u.name || null,
    },
  });
});

/**
 * System endpoints used by smoke tests, uptime monitors, load balancers.
 * Keep them fast + dependency-light.
 */
router.get("/health", (req, res) => res.status(200).json({ ok: true }));
router.get("/healthz", (req, res) => res.status(200).json({ ok: true }));
router.get("/readyz", (req, res) => res.status(200).json({ ok: true }));

// Version endpoint (safe even when git info missing)
router.get("/version", (req, res) => {
  res.status(200).json({
    name: process.env.APP_NAME || "microcourse-backend",
    env: process.env.NODE_ENV || "development",
    commit: process.env.GIT_SHA || null,
    time: new Date().toISOString()
  });
});

module.exports = router;