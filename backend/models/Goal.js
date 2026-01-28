const mongoose = require("mongoose");

const GoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ["active","completed","paused"], default: "active" },
  progress: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Goal", GoalSchema);
