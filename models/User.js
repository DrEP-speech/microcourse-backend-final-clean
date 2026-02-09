const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: "student" }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
