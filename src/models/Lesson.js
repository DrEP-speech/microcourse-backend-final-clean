const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true },
    order: { type: Number, default: 1, index: true },
    content: { type: String, default: "" },
    videoUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Lesson || mongoose.model("Lesson", LessonSchema);
