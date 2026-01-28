const mongoose = require("mongoose");

const BadgeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "🏅" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Badge", BadgeSchema);
