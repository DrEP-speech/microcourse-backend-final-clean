const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true },
    options: [{ type: String, required: true }],
    // canonical
    answerIndex: { type: Number, required: true },
    explanation: { type: String, default: "" },

    // legacy: some old quizzes had correctIndex; migration removes it
    correctIndex: { type: Number }
  },
  { _id: false }
);

const QuizSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true },
    instructions: { type: String, default: "" },
    questions: { type: [QuestionSchema], default: [] },

    createdByEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  },
  { timestamps: true, strict: false }
);

QuizSchema.index({ courseId: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema);
