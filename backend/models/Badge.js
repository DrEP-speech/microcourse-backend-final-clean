const mongoose = require("mongoose");

const BadgeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: String,
  icon: String,
  criteria: Object
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("Badge", BadgeSchema);
