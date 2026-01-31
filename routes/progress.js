const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { myProgress } = require("../controllers/progressController");

// GET /api/progress/me
router.get("/me", requireAuth, myProgress);

module.exports = router;