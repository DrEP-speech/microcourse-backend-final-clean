require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

function requireModel(path) {
  try { return require(path); }
  catch (e) {
    console.error("Missing model:", path, e.message);
    process.exit(1);
  }
}

const User = requireModel("../src/models/User");

async function upsertUser({ email, name, role, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const update = { email, name, role, passwordHash };
  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
  const doc = await User.findOneAndUpdate({ email }, update, opts);
  return doc;
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");

  await mongoose.connect(uri);
  console.log("✅ Mongo connected (seed-demo)");

  const instructor = await upsertUser({
    email: "instructor1@demo.local",
    name: "Demo Instructor",
    role: "instructor",
    password: "Password123!",
  });

  const student = await upsertUser({
    email: "student1@demo.local",
    name: "Demo Student",
    role: "student",
    password: "Password123!",
  });

  console.log("✅ Seeded/updated users:");
  console.log(" -", instructor.email, `(role=${instructor.role})`);
  console.log(" -", student.email, `(role=${student.role})`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("❌ seed-demo failed:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
