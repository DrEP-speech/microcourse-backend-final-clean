const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const { studentOverview, teacherSummaryInsights } = require("../controllers/analyticsController");

// GET /api/analytics/student/overview
router.get("/student/overview", requireAuth, studentOverview);

// GET /api/analytics/teacher/summary-insights
router.get(
  "/teacher/summary-insights",
  requireAuth,
  requireRole("admin", "instructor"),
  teacherSummaryInsights
);

module.exports = router;