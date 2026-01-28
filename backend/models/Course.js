const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  description: String,
  language: String,
  level: { type: String, enum: ["beginner","intermediate","advanced"], default: "beginner" },
  tags: [String],
  coverImage: String,
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }],
  published: { type: Boolean, default: false }
}, { timestamps: true });

CourseSchema.index({ title: "text", tags: 1 });

module.exports = mongoose.model("Course", CourseSchema);
