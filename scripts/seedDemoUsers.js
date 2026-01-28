require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../src/models/User");

async function main() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL;

  if (!uri) {
    console.error("❌ No Mongo URI found. Set MONGO_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const users = [
    {
      email: "instructor1@demo.local",
      password: "Password123!",
      role: "instructor",
      name: "Demo Instructor"
    },
    {
      email: "student1@demo.local",
      password: "Password123!",
      role: "student",
      name: "Demo Student"
    }
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);

    const doc = await User.findOneAndUpdate(
      { email: u.email.toLowerCase().trim() },
      {
        email: u.email.toLowerCase().trim(),
        password: hash,
        role: u.role,
        name: u.name
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✅ Upserted: ${doc.email} (${doc.role}) id=${doc._id}`);
  }

  await mongoose.disconnect();
  console.log("✅ Done seeding demo users.");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
