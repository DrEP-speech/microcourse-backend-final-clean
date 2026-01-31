const express = require("express");
const router = express.Router();

/**
 * POST /api/email/send (stub)
 */
router.post("/send", async (req, res) => {
  return res.status(501).json({ ok: false, message: "Not implemented: send email" });
});

/**
 * GET /api/email/logs (stub)
 */
router.get("/logs", async (req, res) => {
  return res.status(501).json({ ok: false, message: "Not implemented: email logs" });
});

module.exports = router;