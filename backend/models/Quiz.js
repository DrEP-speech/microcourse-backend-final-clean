const mongoose = require("mongoose");

const OptionSchema = new mongoose.Schema({
  id: String,
  text: String,
  correct: { type: Boolean, default: false }
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  type: { type: String, enum: ["single","multi","truefalse","short","numeric"], required: true },
  options: [OptionSchema],
  points: { type: Number, default: 1 },
  explanation: String
}, { _id: true });

const QuizSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  title: { type: String, required: true },
  questions: { type: [QuestionSchema], default: [] },
  settings: { timeLimitSec: Number, shuffle: Boolean, attempts: Number }
}, { timestamps: true });

QuizSchema.index({ title: 1 });

module.exports = mongoose.model("Quiz", QuizSchema);
