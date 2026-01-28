const mongoose = require("mongoose");

const LessonProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },

    completed: { type: Boolean, default: false },
    completedAt: { type: Date },

    // Useful for video lessons
    lastPositionSeconds: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// One progress record per user+lesson
LessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model("LessonProgress", LessonProgressSchema);
