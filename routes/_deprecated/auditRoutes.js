const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const auditController = require("../controllers/auditController");

// NOTE: You can add admin-only middleware later.
// For now, these are protected by auth only.

router.get("/flagged", requireAuth, auditController.listFlagged);
router.post("/flagged/export.csv", requireAuth, auditController.exportFlaggedCsv);
router.put("/flagged/resolve/:id", requireAuth, auditController.resolveFlag);

module.exports = router;