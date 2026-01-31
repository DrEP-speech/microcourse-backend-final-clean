const mongoose = require("mongoose");

const QuizQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true }, // 0-based
    conceptTag: { type: String, default: "" }, // for analytics + AI later
    points: { type: Number, default: 1 },
  },
  { _id: false }
);

const QuizSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: false },

    title: { type: String, required: true, trim: true },
    questions: { type: [QuizQuestionSchema], default: [] },

    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", QuizSchema);