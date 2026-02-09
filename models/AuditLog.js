const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    kind: { type: String, required: true, index: true }, // e.g. "quiz_submit", "flagged", "export"
    entityType: { type: String, default: "" }, // e.g. "quiz", "course"
    entityId: { type: String, default: "" },
    message: { type: String, default: "" },
    meta: { type: Object, default: {} },
    isFlagged: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

AuditLogSchema.index({ isFlagged: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);