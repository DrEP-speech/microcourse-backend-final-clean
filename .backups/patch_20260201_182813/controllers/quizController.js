const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");

async function listQuizzes(req, res) {
  try {
    const courseId = req.query && req.query.courseId ? String(req.query.courseId) : null;
    const q = { published: true };
    if (courseId) q.courseId = courseId;

    const quizzes = await Quiz.find(q).select("_id title courseId published createdAt").sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, quizzes });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "listQuizzes failed", detail: String(err.message || err) });
  }
}

async function getQuiz(req, res) {
  try {
    const id = req.params.quizId || req.params.id;
    const quiz = await Quiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });
    return res.json({ ok: true, quiz });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "getQuiz failed", detail: String(err.message || err) });
  }
}

// Player-safe view (no correctIndex leakage)
async function getQuizForPlayer(req, res) {
  try {
    const id = req.params.quizId || req.params.id;
    const quiz = await Quiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    const safe = {
      _id: quiz._id,
      title: quiz.title,
      courseId: quiz.courseId,
      published: quiz.published,
      questions: (quiz.questions || []).map((q, idx) => ({
        index: idx,
        prompt: q.prompt,
        choices: q.choices,
        topic: q.topic,
        points: q.points
      }))
    };
    return res.json({ ok: true, quiz: safe });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "getQuizForPlayer failed", detail: String(err.message || err) });
  }
}

async function submitQuiz(req, res) {
  try {
    const id = req.params.quizId || req.params.id;
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ ok: false, error: "answers[] required" });

    const quiz = await Quiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    const questions = quiz.questions || [];
    let score = 0;
    let total = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const pts = Number(q.points || 1);
      total += pts;
      if (Number(answers[i]) === Number(q.correctIndex)) score += pts;
    }

    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    // Persist result if user present
    if (req.user && req.user.id) {
      await QuizResult.create({
        userId: req.user.id,
        quizId: id,
        answers: answers.map(n => Number(n)),
        score,
        total,
        percent
      });
    }

    return res.json({ ok: true, result: { score, total, percent } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "submitQuiz failed", detail: String(err.message || err) });
  }
}

async function myLatestResults(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const rows = await QuizResult.find({ userId }).sort({ createdAt: -1 }).limit(10).lean();
    return res.json({ ok: true, results: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "myLatestResults failed", detail: String(err.message || err) });
  }
}

module.exports = {
  listQuizzes,
  getQuiz,
  getQuizForPlayer,
  submitQuiz,
  myLatestResults,
  getQuiz: notImplemented("getQuiz"),
  getQuizForPlayer: notImplemented("getQuizForPlayer"),
  listQuizzes: notImplemented("listQuizzes"),
  myLatestResults: notImplemented("myLatestResults"),
  submitQuiz: notImplemented("submitQuiz"),

};