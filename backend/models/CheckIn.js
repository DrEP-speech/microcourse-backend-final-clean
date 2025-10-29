const mongoose = require("mongoose");

const CheckInSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  scheduledFor: { type: Date, required: true, index: true },
  status: { type: String, enum: ["scheduled","done","no_show"], default: "scheduled" },
  notes: String
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("CheckIn", CheckInSchema);
