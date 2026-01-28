const mongoose = require("mongoose");

const InsightSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, lowercase: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    insight: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Insight || mongoose.model("Insight", InsightSchema);
