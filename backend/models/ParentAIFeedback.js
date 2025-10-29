const mongoose = require("mongoose");

const ParentAIFeedbackSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  createdAt: { type: Date, default: Date.now },
  feedback: { type: String, required: true },
  insights: [String]
}, { timestamps: false });

module.exports = mongoose.model("ParentAIFeedback", ParentAIFeedbackSchema);
