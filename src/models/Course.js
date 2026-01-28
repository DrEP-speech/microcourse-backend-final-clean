const mongoose = require("mongoose");

/**
 * Minimal slugify without extra deps.
 * Keeps letters/numbers, converts spaces to hyphens, trims repeats.
 */
function slugify(input = "") {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },

    description: { type: String, default: "", trim: true },

    // Ownership (used by course+quiz enforcement)
    // Keep BOTH for backwards compatibility; treat them as equivalent.
    instructorEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    createdByEmail: { type: String, trim: true, lowercase: true, index: true },

    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },

    // Optional metadata (safe defaults)
    thumbnailUrl: { type: String, default: "" },
    tags: [{ type: String }],
    estimatedMinutes: { type: Number, default: 0 },
    level: { type: String, default: "" },      // e.g., beginner/intermediate/advanced
    language: { type: String, default: "en" }, // future-ready

    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Keep createdByEmail aligned for older code paths
CourseSchema.pre("validate", function (next) {
  if (!this.createdByEmail && this.instructorEmail) {
    this.createdByEmail = this.instructorEmail;
  }
  if (!this.instructorEmail && this.createdByEmail) {
    this.instructorEmail = this.createdByEmail;
  }
  if (!this.slug && this.title) {
    this.slug = slugify(this.title);
  }
  next();
});

// If publishing, set publishedAt once
CourseSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.models.Course || mongoose.model("Course", CourseSchema);