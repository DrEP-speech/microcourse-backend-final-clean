const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/**
 * GET /api/health
 * Returns service health + DB connection state (mongoose).
 */
router.get("/", (req, res) => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    ok: true,
    service: "microcourse-backend",
    timestamp: new Date().toISOString(),
    db: {
      state: states[mongoose.connection.readyState] || "unknown",
      readyState: mongoose.connection.readyState,
      name: mongoose.connection.name || null,
      host: mongoose.connection.host || null,
    }
  });
});

module.exports = router;