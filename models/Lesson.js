// models/Lesson.js
"use strict";

const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: "", trim: true },

    videoUrl: { type: String, default: "", trim: true },
    durationMinutes: { type: Number, default: 0, min: 0 },

    // Display/order within a course
    order: { type: Number, default: 0, min: 0, index: true },

    // Visibility switch (matches what you’re using in API results)
    published: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Common query pattern: list lessons for a course, ordered
LessonSchema.index({ courseId: 1, order: 1, createdAt: -1 });

module.exports = mongoose.model("Lesson", LessonSchema);
