const mongoose = require("mongoose");

const InsightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
  summary: { type: String, required: true },
  missedConcepts: [String],
  recommendations: [String]
}, { timestamps: true });

module.exports = mongoose.model("Insight", InsightSchema);
