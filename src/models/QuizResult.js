const mongoose = require("mongoose");

const QuizResultSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    userEmail: { type: String, index: true },

    quizId: { type: String, required: true, index: true },

    answers: { type: [mongoose.Schema.Types.Mixed], default: [] },

    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizResult", QuizResultSchema);
