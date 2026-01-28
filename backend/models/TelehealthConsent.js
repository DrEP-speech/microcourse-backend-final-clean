const mongoose = require("mongoose");

const TelehealthConsentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
  signedAt: { type: Date, required: true },
  signerName: { type: String, required: true },
  signerRole: String,
  pdfUrl: String,
  metadata: Object
}, { timestamps: true });

module.exports = mongoose.model("TelehealthConsent", TelehealthConsentSchema);
