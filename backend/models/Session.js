const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ["scheduled","completed","cancelled"], default: "scheduled" },
  notes: String,
  zoomLink: String,
  consentId: { type: mongoose.Schema.Types.ObjectId, ref: "TelehealthConsent" },
  auditLogIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "AuditLog" }],
  tags: [String]
}, { timestamps: true });

SessionSchema.index({ therapistId: 1, startsAt: -1 });

module.exports = mongoose.model("Session", SessionSchema);
