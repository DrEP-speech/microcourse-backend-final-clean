const mongoose = require("mongoose");

const QuizAnswerSchema = new mongoose.Schema(
  {
    questionIndex: { type: Number, required: true },
    selectedIndex: { type: Number, required: true },
    correctIndex: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true },
    conceptTag: { type: String, default: "" },
    pointsAwarded: { type: Number, default: 0 },
  },
  { _id: false }
);

const QuizResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
  breakdown: [{ index: Number, correct: Boolean }],
  answers: [{ index: Number, value: mongoose.Schema.Types.Mixed }],
  passed: { type: Boolean, default: false, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true },

    score: { type: Number, required: true },          // points earned
    maxScore: { type: Number, required: true },       // total possible
    percent: { type: Number, required: true },        // 0-100

    answers: { type: [QuizAnswerSchema], default: [] },

    // Future upgrades
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

QuizResultSchema.index({ userId: 1, quizId: 1, createdAt: -1 });

module.exports = mongoose.model("QuizResult", QuizResultSchema);