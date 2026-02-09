const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");

function pickUserEmail(user) {
  if (!user) return null;
  return (
    user.email ||
    user.userEmail ||
    user.username ||               // sometimes email is used as username
    user.claims?.email ||
    user.claims?.userEmail ||
    user.profile?.email ||
    null
  );
}

function pickUserId(user) {
  if (!user) return null;
  return user._id || user.id || user.userId || user.sub || null;
}

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const userEmail = pickUserEmail(req.user);
    const userId = pickUserId(req.user);

    // Query using whichever identity we have
    const query = [];
    if (userId) query.push({ userId: String(userId) });
    if (userEmail) query.push({ userEmail });

    if (query.length === 0) {
      return res.status(401).json({ ok: false, error: "Auth missing user identity" });
    }

    const results = await QuizResult.find({ $or: query })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ ok: true, results });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
});

router.post("/submit", requireAuth, async (req, res) => {
  try {
    const userEmail = pickUserEmail(req.user);
    const userId = pickUserId(req.user);

    const { quizId, answers } = req.body || {};
    if (!quizId) return res.status(400).json({ ok: false, error: "Missing quizId" });

    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (questions.length === 0) {
      return res.status(400).json({ ok: false, error: "Quiz has no questions" });
    }

    const safeAnswers = Array.isArray(answers) ? answers : [];
    // If client sent too few answers, pad with nulls; if too many, trim
    const normalizedAnswers = safeAnswers.slice(0, questions.length);
    while (normalizedAnswers.length < questions.length) normalizedAnswers.push(null);

    // Score flexibly: supports correctIndex or correctAnswer
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] || {};
      const a = normalizedAnswers[i];

      if (typeof q.correctIndex === "number") {
        if (a === q.correctIndex) score++;
      } else if (q.correctAnswer != null) {
        // string/number compare
        if (String(a) === String(q.correctAnswer)) score++;
      }
    }

    const maxScore = questions.length;
    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    if (!userEmail && !userId) {
      return res.status(401).json({ ok: false, error: "Auth missing email/userId" });
    }

    const created = await QuizResult.create({
      userId: userId ? String(userId) : undefined,
      userEmail: userEmail || undefined,
      quizId: String(quizId),
      answers: normalizedAnswers,
      score,
      maxScore,
      percent,
    });

    return res.status(201).json({
      ok: true,
      resultId: created._id,
      result: created,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
});

module.exports = router;
