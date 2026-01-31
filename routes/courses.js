const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const Course = require("../models/Course");
const Quiz = require("../models/Quiz");

// Public: list published courses
// GET /api/courses
router.get("/", async (req, res) => {
  const courses = await Course.find({ published: true }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, courses });
});

// Public: course detail (published only)
router.get("/:courseId", async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, published: true }).lean();
  if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, course });
});

// Public: published quizzes for course
// GET /api/courses/:courseId/quizzes
router.get("/:courseId/quizzes", async (req, res) => {
  const quizzes = await Quiz.find({ courseId: req.params.courseId, published: true })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ ok: true, quizzes });
});

// Instructor/admin: create course
// POST /api/courses
router.post("/", requireAuth, requireRole("instructor", "admin"), async (req, res) => {
  try {
    const { title, description, level, published } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: "title required" });

    const course = await Course.create({
      title,
      description: description || "",
      level: level || "beginner",
      published: published !== false,
      instructorId: req.user.id,
    });

    res.json({ ok: true, course });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Instructor/admin: create quiz for course
// POST /api/courses/:courseId/quizzes
router.post("/:courseId/quizzes", requireAuth, requireRole("instructor", "admin"), async (req, res) => {
  try {
    const { title, questions, published } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: "title required" });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ ok: false, error: "questions[] required" });
    }

    const quiz = await Quiz.create({
      courseId: req.params.courseId,
      title,
      questions,
      published: published !== false,
    });

    res.json({ ok: true, quiz });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;