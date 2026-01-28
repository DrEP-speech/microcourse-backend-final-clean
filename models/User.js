const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student" },

    // IMPORTANT: select:false means normal queries do NOT return it.
    // In login we must use .select("+password")
    password: { type: String, required: true, select: false }
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (plain) {
  // Prevent "Illegal arguments: string, undefined"
  if (!plain || !this.password) return false;
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", UserSchema);
