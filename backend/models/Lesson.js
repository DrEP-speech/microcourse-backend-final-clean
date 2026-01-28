const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  title: { type: String, required: true },
  videoUrl: String,
  content: String,
  resources: [String],
  durationSec: Number,
  order: { type: Number, required: true, index: true }
}, { timestamps: true });

module.exports = mongoose.model("Lesson", LessonSchema);
