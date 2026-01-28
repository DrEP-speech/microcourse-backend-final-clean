const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendEmail, listEmailLogs } = require("../controllers/emailController");

const router = express.Router();

router.post("/send", requireAuth, requireRole("admin", "instructor"), sendEmail);
router.get("/logs", requireAuth, requireRole("admin", "instructor"), listEmailLogs);

module.exports = router;
