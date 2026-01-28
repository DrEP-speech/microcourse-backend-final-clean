const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { listMyNotifications, markRead } = require("../controllers/notificationController");

const router = express.Router();

router.get("/mine", requireAuth, listMyNotifications);
router.put("/:id/read", requireAuth, markRead);

module.exports = router;
