const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true, unique: true },
  passwordHash: { type: String },
  name: { type: String, required: true },
  role: { type: String, enum: ["student","instructor","parent","admin"], required: true },
  avatarUrl: String,
  badges: [{ type: mongoose.Schema.Types.ObjectId, ref: "Badge" }],
  settings: {
    locale: String,
    timezone: String,
    notificationsEnabled: { type: Boolean, default: true }
  },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

UserSchema.index({ role: 1 });

module.exports = mongoose.model("User", UserSchema);
