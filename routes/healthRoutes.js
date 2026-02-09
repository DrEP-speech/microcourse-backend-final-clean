const express = require("express");
const router = express.Router();

/**
 * These endpoints are intentionally simple and unauthenticated.
 * They should never throw unless the process itself is unhealthy.
 */
router.get(["/health", "/healthz"], (req, res) => {
  res.status(200).json({ ok: true });
});

router.get("/readyz", (req, res) => {
  // server.js attaches a function; if missing, we still report process OK
  const dbReady = typeof req.app.locals.dbReady === "function"
    ? !!req.app.locals.dbReady()
    : false;

  res.status(200).json({
    ok: true,
    ready: true,
    dbReady,
    time: new Date().toISOString(),
  });
});

module.exports = router;