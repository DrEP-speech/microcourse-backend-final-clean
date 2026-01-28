const express = require("express");
const router = express.Router();

// Gate all debug routes behind DEBUG_ROUTES=1 (and never mount in prod)
function allowed() {
  return process.env.DEBUG_ROUTES === "1" || process.env.NODE_ENV !== "production";
}

router.get("/sample-grade-payload/:quizId?", async (req, res, next) => {
  try {
    if (!allowed()) return res.status(404).json({ success:false, message: "Not found" });
    const { Quiz } = req.app.locals.models;
    const quizId = req.params.quizId;

    const quiz = quizId
      ? await Quiz.findById(quizId)
      : await Quiz.findOne().sort({ updatedAt: -1 });

    if (!quiz) return res.status(404).json({ success:false, message:"No quiz found" });

    // Build answers from quiz options (correct -> selected/input)
    const answers = [];
    for (const q of quiz.questions) {
      if (q.type === "single") {
        const ok = (q.options || []).find(o => o.correct);
        answers.push({ questionId: String(q._id), selected: ok ? [ok.id] : [] });
      } else if (q.type === "multi") {
        const ids = (q.options || []).filter(o => o.correct).map(o => o.id);
        answers.push({ questionId: String(q._id), selected: ids });
      } else if (q.type === "short") {
        const ok = (q.options || []).find(o => o.correct);
        answers.push({ questionId: String(q._id), input: ok ? ok.text : "" });
      } else if (q.type === "numeric") {
        const ok = (q.options || []).find(o => o.correct);
        const val = ok ? Number(ok.text) : null;
        answers.push({ questionId: String(q._id), input: val });
      } else {
        answers.push({ questionId: String(q._id), selected: [] });
      }
    }

    // default demo user from your seed
    const userId = "650000000000000000000002";
    res.json({
      success: true,
      payload: { quizId: String(quiz._id), userId, answers },
      quiz: { _id: String(quiz._id), title: quiz.title, questionCount: quiz.questions?.length || 0 },
    });
  } catch (err) { next(err); }
});

module.exports = router;
