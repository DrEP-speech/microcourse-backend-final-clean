const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const { listBadges, myBadges, awardBadge } = require("../controllers/badgeController");

// GET /api/badges
router.get("/", requireAuth, listBadges);

// GET /api/badges/mine
router.get("/mine", requireAuth, myBadges);

// POST /api/badges/award
router.post("/award", requireAuth, requireRole("admin", "instructor"), awardBadge);

module.exports = router;