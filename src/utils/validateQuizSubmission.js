function validateQuizSubmission(quiz, answers) {
  if (!quiz || !Array.isArray(quiz.questions)) {
    return { ok: false, status: 500, error: "Quiz is malformed (missing questions)" };
  }
  if (!Array.isArray(answers)) {
    return { ok: false, status: 400, error: "answers must be an array" };
  }
  if (answers.length !== quiz.questions.length) {
    return {
      ok: false,
      status: 400,
      error: `answers length mismatch (expected ${quiz.questions.length}, got ${answers.length})`
    };
  }

  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const a = answers[i];

    if (!Number.isInteger(a)) {
      return { ok: false, status: 400, error: `answers[${i}] must be an integer` };
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { ok: false, status: 500, error: `Quiz question[${i}] options malformed` };
    }
    if (a < 0 || a >= q.options.length) {
      return { ok: false, status: 400, error: `answers[${i}] out of range (0..${q.options.length - 1})` };
    }
    if (!Number.isInteger(q.answerIndex)) {
      return { ok: false, status: 500, error: `Quiz question[${i}] missing answerIndex (run migration)` };
    }
    if (q.answerIndex < 0 || q.answerIndex >= q.options.length) {
      return { ok: false, status: 500, error: `Quiz question[${i}] answerIndex out of range (data error)` };
    }
  }

  return { ok: true };
}

module.exports = { validateQuizSubmission };
