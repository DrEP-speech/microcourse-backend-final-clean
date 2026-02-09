const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const analytics = require("../controllers/analyticsController");

router.get("/student/overview", requireAuth, analytics.studentOverview);

module.exports = router;