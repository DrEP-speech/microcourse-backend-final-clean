const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  threadId: { type: String, index: true, required: true },
  fromId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  toIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  body: { type: String, required: true },
  attachments: [String]
}, { timestamps: { createdAt: true, updatedAt: false } });

MessageSchema.index({ threadId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);
