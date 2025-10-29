"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["owner", "therapist", "parent", "admin", "user"], default: "user" },
    profile: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Define the *single* unique index for email with a stable name
userSchema.index({ email: 1 }, { unique: true, name: "uniq_email" });

// Hash on create/change
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Hide password in JSON
userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
