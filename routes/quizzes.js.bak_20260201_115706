const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");

const quizController = require("../controllers/quizController");
const quizConsumerController = require("../controllers/quizConsumerController");

function mustFn(name, fn) {
  if (typeof fn !== "function") {
    throw new Error(`[routes/quizzes] Handler ${name} is not a function (got ${typeof fn}).`);
  }
  return fn;
}

const listQuizzes         = mustFn("listQuizzes", quizController.listQuizzes);
const getQuiz             = mustFn("getQuiz", quizController.getQuiz);
const myLatestResults     = mustFn("myLatestResults", quizController.myLatestResults);
const createQuiz          = mustFn("createQuiz", quizController.createQuiz);
const updateQuiz          = mustFn("updateQuiz", quizController.updateQuiz);
const deleteQuiz          = mustFn("deleteQuiz", quizController.deleteQuiz);
const submitQuiz          = mustFn("submitQuiz", quizController.submitQuiz);

const getQuizForPlayer    = mustFn("getQuizForPlayer", quizConsumerController.getQuizForPlayer);
const submitQuizConsumer  = mustFn("submitQuizConsumer", quizConsumerController.submitQuizConsumer);

router.get("/", requireAuth, listQuizzes);
router.get("/me/latest", requireAuth, myLatestResults);
router.get("/:quizId", requireAuth, getQuiz);

router.get("/:quizId/player", requireAuth, getQuizForPlayer);
router.post("/:quizId/submit-consumer", requireAuth, submitQuizConsumer);
router.post("/:quizId/submit", requireAuth, requireRole("student"), submitQuiz);

router.post("/", requireAuth, requireRole("admin", "instructor"), createQuiz);
router.put("/:quizId", requireAuth, requireRole("admin", "instructor"), updateQuiz);
router.delete("/:quizId", requireAuth, requireRole("admin", "instructor"), deleteQuiz);

module.exports = router;