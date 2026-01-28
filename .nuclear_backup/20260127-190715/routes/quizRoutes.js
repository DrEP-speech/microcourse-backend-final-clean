const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const quizController = require("../controllers/quizController");

// Students & instructors can list/fetch (with rules enforced in controller)
router.get("/", requireAuth, quizController.listQuizzes);
router.get("/:quizId", requireAuth, quizController.getQuiz);

// Instructors/admin only
router.post("/", requireAuth, requireRole("instructor", "admin"), quizController.createQuiz);
router.put("/:quizId", requireAuth, requireRole("instructor", "admin"), quizController.updateQuiz);
router.delete("/:quizId", requireAuth, requireRole("instructor", "admin"), quizController.deleteQuiz);

module.exports = router;
