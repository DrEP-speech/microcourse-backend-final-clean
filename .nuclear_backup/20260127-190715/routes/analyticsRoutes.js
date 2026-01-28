const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { studentOverview, teacherSummaryInsights } = require("../controllers/analyticsController");

const router = express.Router();

router.get("/student/overview", requireAuth, studentOverview);
router.get("/teacher/summary-insights", requireAuth, teacherSummaryInsights);

module.exports = router;
