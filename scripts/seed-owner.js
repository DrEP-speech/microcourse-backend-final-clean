require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../src/models/User");

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = process.env.SEED_OWNER_EMAIL || "owner@microcourse.local";
  const password = process.env.SEED_OWNER_PASSWORD || "ChangeMe123!";
  const name = process.env.SEED_OWNER_NAME || "Owner Admin";

  if (!uri) throw new Error("MONGODB_URI missing");

  await mongoose.connect(uri);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Seed owner: already exists:", email);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email, passwordHash, role: "admin" });

  console.log("✅ Seed owner created:", email, "(role=admin)");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Seed owner failed:", e.message);
  process.exit(1);
});
