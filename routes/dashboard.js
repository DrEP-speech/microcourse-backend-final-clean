const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

// Minimal dashboard payload (expand later)
router.get("/", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    dashboard: {
      user: req.user,
      message: "Dashboard online"
    }
  });
});

module.exports = router;