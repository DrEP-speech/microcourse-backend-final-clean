const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { listMyNotifications, markRead } = require("../controllers/notificationController");

// GET /api/notifications/mine
router.get("/mine", requireAuth, listMyNotifications);

// PUT /api/notifications/:id/read
router.put("/:id/read", requireAuth, markRead);

module.exports = router;