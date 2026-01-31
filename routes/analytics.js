const express = require("express");
const router = express.Router();

/**
 * GET /api/analytics/student (stub)
 */
router.get("/student", async (req, res) => {
  return res.status(501).json({ ok: false, message: "Not implemented: student analytics" });
});

/**
 * GET /api/analytics/teacher (stub)
 */
router.get("/teacher", async (req, res) => {
  return res.status(501).json({ ok: false, message: "Not implemented: teacher analytics" });
});

module.exports = router;