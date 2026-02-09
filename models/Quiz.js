const mongoose = require("mongoose");

const QuizQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    options: { type: [String], required: true, default: [] },
    correctIndex: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const QuizSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    title: { type: String, trim: true, required: true },
    questions: { type: [QuizQuestionSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema);
