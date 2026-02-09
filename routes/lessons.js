const { ensureFns, ensureRouter, makeHandler } = require("../utils/routeGuard");
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
let lessonController = require("../controllers/lessonController");

lessonController = ensureFns("lessonController", lessonController, ["ping", "listLessons", "getLessonById", "createLesson", "updateLesson", "deleteLesson"]);
// Boot-time guard: crash early if any handler is missing / not a function
ensureFns("lessonController", lessonController, [
  "ping",
  "listLessons",
  "getLessonById",
  "createLesson",
  "updateLesson",
  "deleteLesson",
]);

/**
 * Sanity
 */
router.get("/ping", lessonController.ping);

/**
 * Public routes
 */
router.get("/", lessonController.listLessons);
router.get("/:id", lessonController.getLessonById);

/**
 * Protected routes (instructor/admin/owner)
 */
router.post(
  "/",
  requireAuth,
  requireRole("instructor", "admin", "owner"),
  lessonController.createLesson
);

router.put(
  "/:id",
  requireAuth,
  requireRole("instructor", "admin", "owner"),
  lessonController.updateLesson
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("instructor", "admin", "owner"),
  lessonController.deleteLesson
);

module.exports = router;