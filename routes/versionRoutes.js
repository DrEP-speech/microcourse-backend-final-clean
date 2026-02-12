const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    name: process.env.SERVICE_NAME || "microcourse-backend",
    version: process.env.APP_VERSION || process.env.npm_package_version || "0.0.0",
    commit: process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || null,
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString()
  });
});

module.exports = router;