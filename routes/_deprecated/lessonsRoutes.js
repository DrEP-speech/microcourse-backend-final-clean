const express = require("express");
const router = express.Router();

const { ensureFns } = require("../utils/routeGuard");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const lessonController = require("../controllers/lessonController");

// Boot-time guard: explode early if any handler is missing or not a function
ensureFns("lessonController", lessonController, [
  "ping",
  "listLessons",
  "getLessonById",
  "createLesson",
  "updateLesson",
  "deleteLesson"
]);

// Quick sanity check
router.get("/ping", (req, res) => res.json({ ok: true, route: "lessonsRoutes" }));

/**
 * Public routes
 * (Edit these as needed)
 */
// router.get("/", lessonController.list);
// router.get("/:id", lessonController.getById);

/**
 * Protected routes
 * (Edit roles as needed)
 */
// router.post("/", requireAuth, requireRole("instructor","admin","owner"), lessonController.create);
// router.put("/:id", requireAuth, requireRole("instructor","admin","owner"), lessonController.update);
// router.delete("/:id", requireAuth, requireRole("instructor","admin","owner"), lessonController.remove);

module.exports = router;