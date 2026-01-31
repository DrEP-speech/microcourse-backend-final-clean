const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student" },

    // Optional profile fields for future upgrades
    badges: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);