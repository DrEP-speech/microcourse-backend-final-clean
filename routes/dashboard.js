const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { getDashboard } = require("../controllers/dashboardController");

// GET /api/dashboard
router.get("/", requireAuth, getDashboard);

module.exports = router;