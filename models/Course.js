const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },

    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", CourseSchema);