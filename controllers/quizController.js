/**
 * controllers/quizController.js
 * Stub-safe exports so routes never receive undefined handlers.
 */

const notImpl = (name) => async (req, res) =>
  res.status(501).json({ error: `${name} not implemented` });

const listQuizzes = notImpl("listQuizzes");
const getQuiz = notImpl("getQuiz");
const myLatestResults = notImpl("myLatestResults");
const createQuiz = notImpl("createQuiz");
const updateQuiz = notImpl("updateQuiz");
const deleteQuiz = notImpl("deleteQuiz");
const submitQuiz = notImpl("submitQuiz");

module.exports = {
  listQuizzes,
  getQuiz,
  myLatestResults,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  submitQuiz,
};
