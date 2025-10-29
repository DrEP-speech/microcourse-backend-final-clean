const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  entity: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  ts: { type: Date, required: true, index: true },
  details: Object,
  severity: { type: String, enum: ["info","warning","critical"], default: "info" }
}, { timestamps: false });

AuditLogSchema.index({ entity: 1, entityId: 1, ts: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
