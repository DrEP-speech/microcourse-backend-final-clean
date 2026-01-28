const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },

    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },

    score: { type: Number, required: true },          // percent 0..100
    total: { type: Number, required: true },          // number of questions
    correctCount: { type: Number, required: true },

    answers: { type: [Number], default: [] },

    // Idempotency: prevents double submissions on refresh
    attemptKey: { type: String, required: true, index: true },

  },
  { timestamps: true, strict: false }
);

ResultSchema.index({ userId: 1, quizId: 1, attemptKey: 1 }, { unique: true });

module.exports = mongoose.models.Result || mongoose.model("Result", ResultSchema);
