const express = require("express");
const Course = require("../models/Course");
const Quiz = require("../models/Quiz");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Public: list published courses
router.get("/", async (req, res) => {
  const courses = await Course.find({ published: true }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, courses });
});

// Instructor: create course
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

// Public: list quizzes for a course
router.get("/:courseId/quizzes", async (req, res) => {
  const quizzes = await Quiz.find({ courseId: req.params.courseId, published: true }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, quizzes });
});

// Instructor: create quiz for course
router.post("/:courseId/quizzes", requireAuth, requireRole("instructor", "admin"), async (req, res) => {
  try {
    const { title, questions } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: "title required" });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ ok: false, error: "questions[] required" });
    }

    const quiz = await Quiz.create({
      courseId: req.params.courseId,
      title,
      questions,
      published: true,
    });

    res.json({ ok: true, quiz });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
