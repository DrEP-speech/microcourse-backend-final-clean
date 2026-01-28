const express = require("express");
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/insights/quiz/:quizId
 * Returns quick insights based on the latest attempt by the current user.
 */
router.get("/quiz/:quizId", requireAuth, async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

  const latest = await QuizResult.findOne({
    quizId: quiz._id,
    userEmail: req.user.email
  }).sort({ createdAt: -1 }).lean();

  if (!latest) {
    return res.json({
      ok: true,
      insights: {
        message: "No attempts yet. Take the quiz once, then I can analyze patterns.",
        focusAreas: [],
        nextSteps: []
      }
    });
  }

  const missed = [];
  quiz.questions.forEach((q, i) => {
    if (latest.answers[i] !== q.correctIndex) missed.push({ i, prompt: q.prompt, explanation: q.explanation || "" });
  });

  const focusAreas = missed.slice(0, 3).map(m => m.prompt);
  const nextSteps = [
    "Retake the quiz aiming for +10% improvement.",
    "Review lesson steps related to navigation + workflow.",
    "Use the app once end-to-end without pausing—build fluency."
  ];

  res.json({
    ok: true,
    insights: {
      score: latest.score,
      maxScore: latest.maxScore,
      percent: latest.percent,
      focusAreas,
      missedCount: missed.length,
      nextSteps
    }
  });
});

module.exports = router;
