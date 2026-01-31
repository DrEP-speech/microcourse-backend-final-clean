const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 1 },

    // Future: video URL, content blocks, etc.
    content: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lesson", LessonSchema);