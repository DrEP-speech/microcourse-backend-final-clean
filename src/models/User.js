const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    username: { type: String, trim: true, unique: true, sparse: true },
    name: { type: String, trim: true },
    role: { type: String, default: "student", enum: ["student", "instructor", "admin"] },

    // Store hash only (never plaintext)
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);