import express from "express";
const router = express.Router();

// examples – match your handlers
router.get("/", listBadges);
router.post("/", requireAdmin, createBadge);
router.delete("/:id", requireAdmin, deleteBadge);
router.post("/award", requireAdmin, awardBadge);
router.post("/sync", requireAdmin, syncBadges);

export default router;
