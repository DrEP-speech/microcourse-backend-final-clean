const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate } = require("../validators/validate");
const { lessonCreateSchema, lessonUpdateSchema } = require("../validators/lessonValidators");
const { listLessons, createLesson, updateLesson, deleteLesson } = require("../controllers/lessonController");

const router = express.Router();

router.get("/", requireAuth, listLessons);
router.post("/", requireAuth, requireRole("admin", "instructor"), validate(lessonCreateSchema), createLesson);
router.put("/:id", requireAuth, requireRole("admin", "instructor"), validate(lessonUpdateSchema), updateLesson);
router.delete("/:id", requireAuth, requireRole("admin", "instructor"), deleteLesson);

module.exports = router;