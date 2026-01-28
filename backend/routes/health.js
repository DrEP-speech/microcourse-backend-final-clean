const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

router.get("/healthz", (req, res) => {
  const dbReady = mongoose.connection.readyState; // 1 = connected
  res.json({ ok: dbReady === 1, dbReady, uptime: process.uptime() });
});

router.get("/health", (req, res) => {
  const conn = mongoose.connection;
  res.json({
    ok: conn.readyState === 1,
    env: process.env.NODE_ENV || "development",
    db: { name: conn.name, host: conn.host, readyState: conn.readyState },
    uptime: process.uptime()
  });
});

module.exports = router;
