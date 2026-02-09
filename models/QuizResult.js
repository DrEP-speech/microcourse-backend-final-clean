const mongoose = require("mongoose");

const QuizResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    score: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    answers: { type: [Number], default: [] },
    passed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

QuizResultSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.QuizResult || mongoose.model("QuizResult", QuizResultSchema);
