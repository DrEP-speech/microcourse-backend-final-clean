const express = require("express");
const router = express.Router();

/**
 * GET /api/notifications (stub)
 */
router.get("/", async (req, res) => {
  return res.status(501).json({ ok: false, message: "Not implemented: list notifications" });
});

module.exports = router;