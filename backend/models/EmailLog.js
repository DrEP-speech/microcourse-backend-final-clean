const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema({
  to: [{ type: String, index: true }],
  cc: [String],
  bcc: [String],
  subject: { type: String, required: true },
  template: String,
  payload: Object,
  success: { type: Boolean, default: true },
  errorMsg: String,
  type: { type: String, enum: ["results","insights","reminder","system"], default: "system" }
}, { timestamps: { createdAt: true, updatedAt: false } });

EmailLogSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("EmailLog", EmailLogSchema);
