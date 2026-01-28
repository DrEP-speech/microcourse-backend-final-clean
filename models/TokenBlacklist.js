const mongoose = require('mongoose');

const blSchema = new mongoose.Schema({
  token:     { type: String, required: true, unique: true, index: true },
  revokedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('TokenBlacklist', blSchema);
