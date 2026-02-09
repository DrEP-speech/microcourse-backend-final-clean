const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const quiz = require("../controllers/quizController");

router.get("/", requireAuth, quiz.list);

module.exports = router;