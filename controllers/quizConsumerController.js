/**
 * controllers/quizConsumerController.js
 * Consumer-safe endpoints that return a "playable" view.
 */

function ok(res, data) {
  return res.json({ ok: true, data });
}

function fail(res, code, message) {
  return res.status(code).json({ ok: false, message });
}

// Return quiz without exposing correct answers (for real play)
async function getQuizForPlayer(req, res) {
  const quizId = req.params.quizId;
  try {
    const Quiz = require("../models/Quiz");
    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) return fail(res, 404, "Quiz not found");

    // Remove answer keys
    const questions = (quiz.questions || quiz.items || []).map(q => {
      const copy = { ...q };
      delete copy.correct;
      delete copy.correctIndex;
      delete copy.answerIndex;
      delete copy.answer;
      return copy;
    });

    return ok(res, { quiz: { ...quiz, questions } });
  } catch (_e) {
    return fail(res, 500, "Failed to load quiz for player");
  }
}

// Consumer submit route (cookie auth)
async function submitQuizConsumer(req, res) {
  // Delegate to quizController submitQuiz if available
  try {
    const quizController = require("./quizController");
    if (typeof quizController.submitQuiz === "function") {
      return quizController.submitQuiz(req, res);
    }
  } catch (_e) {}
  return fail(res, 501, "submitQuizConsumer not implemented");
}

module.exports = {
  getQuizForPlayer,
  submitQuizConsumer,
};