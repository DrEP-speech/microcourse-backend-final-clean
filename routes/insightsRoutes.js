const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");

/**
 * GET /api/insights/quiz/:quizId
 * Returns quick insights based on the latest attempt by the current user.
 */
router.get("/quiz/:quizId", requireAuth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).lean();
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    const latest = await QuizResult.findOne({
      quizId: quiz._id,
      userEmail: req.user.email,
    }).sort({ createdAt: -1 }).lean();

    if (!latest) {
      return res.json({
        ok: true,
        insights: {
          message: "No attempts yet. Take the quiz once, then I can analyze patterns.",
          focusAreas: [],
          nextSteps: [],
        },
      });
    }

    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const answers = Array.isArray(latest.answers) ? latest.answers : [];

    const missed = [];
    questions.forEach((q, i) => {
      if (answers[i] !== q.correctIndex) {
        missed.push({
          i,
          prompt: q.prompt,
          explanation: q.explanation || "",
        });
      }
    });

    const focusAreas = missed.slice(0, 3).map(m => m.prompt);
    const nextSteps = [
      "Retake the quiz aiming for +10% improvement.",
      "Review lesson steps related to the missed items.",
      "Do one end-to-end run without pausing to build fluency.",
    ];

    res.json({
      ok: true,
      insights: {
        score: latest.score,
        maxScore: latest.maxScore,
        percent: latest.percent,
        focusAreas,
        missedCount: missed.length,
        nextSteps,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;