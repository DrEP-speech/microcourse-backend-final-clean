const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    durationMinutes: { type: Number, default: 5 },
    order: { type: Number, default: 1 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lesson", LessonSchema, "lessons");
