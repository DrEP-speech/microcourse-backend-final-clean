const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema(
  {
    type: { type: String, default: "generic" },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    status: { type: String, enum: ["queued", "sent", "failed"], default: "queued" },
    error: { type: String, default: "" },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailLog", EmailLogSchema);
