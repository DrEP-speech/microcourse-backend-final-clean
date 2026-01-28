const mongoose = require("mongoose");
const Result = require("../models/Result");
const Quiz = require("../models/Quiz");
const Course = require("../models/Course");

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function toInt(n) {
  return Number.isInteger(n) ? n : (Number.isInteger(parseInt(n, 10)) ? parseInt(n, 10) : null);
}

exports.submit = async (req, res) => {
  try {
    const { courseId, quizId, answers, attemptKey } = req.body;

    if (!attemptKey || typeof attemptKey !== "string" || attemptKey.trim().length < 8) {
      return res.status(400).json({ ok: false, error: "attemptKey required (min 8 chars)" });
    }

    if (!isObjectId(courseId)) return res.status(400).json({ ok: false, error: "Invalid courseId" });
    if (!isObjectId(quizId)) return res.status(400).json({ ok: false, error: "Invalid quizId" });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ ok: false, error: "Course not found" });

    // Students can only submit for published courses
    if (req.user.role === "student" && course.status !== "published") {
      return res.status(403).json({ ok: false, error: "Course not published" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    if (String(quiz.courseId) !== String(courseId)) {
      return res.status(400).json({ ok: false, error: "Quiz does not belong to course" });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ ok: false, error: "answers must be an array" });
    }

    const total = quiz.questions.length;

    // Hardening: length mismatch
    if (answers.length !== total) {
      return res.status(400).json({ ok: false, error: `answers length mismatch (expected ${total})` });
    }

    // Idempotency: return existing attempt if already submitted
    const existing = await Result.findOne({
      userId: req.user.id,
      quizId,
      attemptKey: attemptKey.trim(),
    });

    if (existing) {
      return res.json({ ok: true, result: existing, idempotent: true });
    }

    let correctCount = 0;

    for (let i = 0; i < total; i++) {
      const q = quiz.questions[i];
      const ans = toInt(answers[i]);

      // Hardening: non-int
      if (ans === null) {
        return res.status(400).json({ ok: false, error: `Answer at index ${i} must be an integer` });
      }

      // Hardening: out-of-range
      if (ans < 0 || ans >= q.options.length) {
        return res.status(400).json({ ok: false, error: `Answer at index ${i} out of range` });
      }

      if (ans === q.answerIndex) correctCount++;
    }

    const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);

    const result = await Result.create({
      userId: req.user.id,
      userEmail: req.user.email,
      courseId,
      quizId,
      score,
      total,
      correctCount,
      answers,
      attemptKey: attemptKey.trim(),
    });

    return res.status(201).json({ ok: true, result });
  } catch (err) {
    // Prevent server crash
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.myResults = async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ ok: true, results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
