const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },

    // The creator/owner (instructor/admin)
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Simple publish flag (public list shows only published)
    isPublished: { type: Boolean, default: false },

    // Optional: lightweight metadata
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", CourseSchema);
