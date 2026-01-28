const mongoose = require("mongoose");

const AIFeedbackSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    resultId: { type: mongoose.Schema.Types.ObjectId, ref: "QuizResult" },

    score: { type: Number, required: true },
    missedConcepts: { type: [String], default: [] },

    summary: { type: String, required: true },
    nextSteps: { type: [String], default: [] },

    suggestedQuizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
    engine: { type: String, default: "rules-v1" }, // future: openai, etc.
  },
  { timestamps: true }
);

AIFeedbackSchema.index({ userEmail: 1, createdAt: -1 });

module.exports = mongoose.model("AIFeedback", AIFeedbackSchema);
