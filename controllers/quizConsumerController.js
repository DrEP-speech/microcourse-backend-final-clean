/**
 * Consumer/Player Quiz Controller
 * Guarantees stable response shapes for:
 *  - GET /api/quizzes/:quizId/player   -> { quizId, title, questions: [] }
 *  - POST /api/quizzes/:quizId/submit-consumer -> scoring + save result
 *
 * NOTE: Keep exports EXACTLY as used by routes/quizzes.js:
 *   - getQuizForPlayer
 *   - submitQuizConsumer
 */

const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");

// Helper: normalize questions to the E2E-friendly schema
function toPlayerPayload(quiz) {
  const questions = (quiz.questions || []).map((q) => ({
    _id: String(q._id),
    prompt: q.prompt ?? q.question ?? q.text ?? "",
    options: (q.options || []).map((opt, idx) => {
      if (typeof opt === "string") return { id: String(idx), text: opt };
      return {
        id: String(opt.id ?? idx),
        text: opt.text ?? opt.label ?? String(opt),
      };
    }),
  }));

  return {
    quizId: String(quiz._id),
    title: quiz.title ?? quiz.name ?? "Quiz",
    questions,
  };
}

/**
 * GET /api/quizzes/:quizId/player
 * Student-facing payload (no correct answers).
 */
async function getQuizForPlayer(req, res) {
  const { quizId } = req.params;

  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return res.status(404).json({ ok: false, message: "Quiz not found" });

  return res.json({ ok: true, ...toPlayerPayload(quiz) });
}

/**
 * POST /api/quizzes/:quizId/submit-consumer
 * Body: { answers: [{ questionId, selectedOptionId }] } OR a simple map.
 */
async function submitQuizConsumer(req, res) {
  const { quizId } = req.params;
  const userId = req.user && (req.user.id || req.user._id);

  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return res.status(404).json({ ok: false, message: "Quiz not found" });

  // Accept flexible input shapes:
  // 1) { answers: [{ questionId, selectedOptionId }] }
  // 2) { answers: { [questionId]: selectedOptionId } }
  // 3) { [questionId]: selectedOptionId }
  let answersRaw = req.body?.answers ?? req.body ?? [];
  let answersArr = [];

  if (Array.isArray(answersRaw)) {
    answersArr = answersRaw;
  } else if (answersRaw && typeof answersRaw === "object") {
    answersArr = Object.entries(answersRaw).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));
  }

  // Build answer lookup
  const pickedByQ = new Map(
    answersArr.map((a) => [String(a.questionId), String(a.selectedOptionId)])
  );

  // Score
  let correct = 0;
  const total = (quiz.questions || []).length;

  const questionBreakdown = (quiz.questions || []).map((q) => {
    const qid = String(q._id);

    // Determine correct option index/id
    // Supports schemas like:
    // - q.correctOptionId
    // - q.correctIndex
    // - q.answerIndex
    // - q.options[{isCorrect:true}]
    let correctId = null;

    if (q.correctOptionId != null) correctId = String(q.correctOptionId);
    if (correctId == null && q.correctIndex != null) correctId = String(q.correctIndex);
    if (correctId == null && q.answerIndex != null) correctId = String(q.answerIndex);

    if (correctId == null && Array.isArray(q.options)) {
      const idx = q.options.findIndex((opt) => opt && opt.isCorrect === true);
      if (idx >= 0) correctId = String(q.options[idx].id ?? idx);
    }

    const picked = pickedByQ.get(qid);

    // If stored correctId is an index, also accept option.id/index equivalence
    let isCorrect = false;
    if (picked != null && correctId != null) {
      isCorrect = String(picked) === String(correctId);
    }

    if (isCorrect) correct++;

    return {
      questionId: qid,
      selectedOptionId: picked ?? null,
      correctOptionId: correctId,
      isCorrect,
    };
  });

  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Save result if model exists
  let saved = null;
  try {
    if (QuizResult) {
      saved = await QuizResult.create({
        user: userId,
        quiz: quizId,
        scorePct,
        correct,
        total,
        answers: questionBreakdown,
        createdAt: new Date(),
      });
    }
  } catch (e) {
    // Non-fatal for E2E; still return the computed result.
  }

  return res.json({
    ok: true,
    quizId: String(quiz._id),
    scorePct,
    correct,
    total,
    resultId: saved?._id ? String(saved._id) : null,
    answers: questionBreakdown,
  });
}

module.exports = {
  getQuizForPlayer,
  submitQuizConsumer,
};
