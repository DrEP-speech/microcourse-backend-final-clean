const mongoose = require("mongoose");

const QuizResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    answers: { type: [Number], default: [] },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizResult", QuizResultSchema);
