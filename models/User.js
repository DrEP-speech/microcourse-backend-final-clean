"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["owner", "admin", "user"], default: "user" },
    profile: {
      displayName: { type: String, default: "" },
      avatarUrl: { type: String, default: "" }
    }
  },
  { timestamps: true, versionKey: false }
);

// ✅ single source of truth for uniqueness (prevents “duplicate index” warnings)
userSchema.index({ email: 1 }, { unique: true, name: "uniq_email" });

// Hash on create/change only
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Hide password on toJSON
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
