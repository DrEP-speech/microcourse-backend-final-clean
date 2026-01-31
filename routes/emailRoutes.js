const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const { sendEmail, listEmailLogs } = require("../controllers/emailController");

// POST /api/email/send
router.post("/send", requireAuth, requireRole("admin", "instructor"), sendEmail);

// GET /api/email/logs
router.get("/logs", requireAuth, requireRole("admin", "instructor"), listEmailLogs);

module.exports = router;