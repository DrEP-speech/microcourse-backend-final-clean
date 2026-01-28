const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listBadges, myBadges, awardBadge } = require("../controllers/badgeController");

const router = express.Router();

router.get("/", requireAuth, listBadges);
router.get("/mine", requireAuth, myBadges);
router.post("/award", requireAuth, requireRole("admin", "instructor"), awardBadge);

module.exports = router;
