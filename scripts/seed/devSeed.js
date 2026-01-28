require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// IMPORTANT: from scripts/seed -> models is ../../models
const User = require("../../models/User");
const Course = require("../../models/Course");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing in .env`);
  return v;
}

async function connectDB() {
  await mongoose.connect(mustEnv("MONGO_URI"));
  console.log("✅ DB connected");
}

async function upsertUser({ email, password, role, name }) {
  // Always hash here so the seed works regardless of User model middleware.
  const hash = await bcrypt.hash(password, 10);

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, password: hash, role, name });
  } else {
    user.password = hash;
    user.role = role;
    user.name = name;
    await user.save();
  }
  return user;
}

async function upsertCourse({ instructorId }) {
  const slug = "microcourse-forge-how-to-use-this-app-start-here";

  let course = await Course.findOne({ slug });

  if (!course) {
    // Minimal fields only; don’t assume optional schema fields exist.
    const payload = {
      title: "MicroCourse Forge – How to Use This App (Start Here)",
      description: "A quick onboarding course seeded for E2E testing.",
      slug,
    };

    // These are common across your evolving schemas; adjust if yours differs:
    if (Course.schema?.path?.("published")) payload.published = true;
    if (Course.schema?.path?.("status")) payload.status = "published";
    if (Course.schema?.path?.("createdBy")) payload.createdBy = instructorId;
    if (Course.schema?.path?.("instructorId")) payload.instructorId = instructorId;
    if (Course.schema?.path?.("instructor")) payload.instructor = instructorId;
    if (Course.schema?.path?.("owner")) payload.owner = instructorId;

    course = await Course.create(payload);
  }

  return course;
}

async function main() {
  const outFile = path.resolve(process.cwd(), "seed-artifacts.json");

  // Defaults (override via env if you want)
  const instructorEmail = process.env.SEED_INSTRUCTOR_EMAIL || "instructor@example.com";
  const studentEmail = process.env.SEED_STUDENT_EMAIL || "student@example.com";
  const password = process.env.SEED_PASSWORD || "Passw0rd!";

  await connectDB();

  const instructor = await upsertUser({
    email: instructorEmail,
    password,
    role: "instructor",
    name: "Demo Instructor",
  });

  const student = await upsertUser({
    email: studentEmail,
    password,
    role: "student",
    name: "Demo Student",
  });

  const course = await upsertCourse({ instructorId: instructor._id });

  const artifacts = {
    ok: true,
    seededAt: new Date().toISOString(),
    apiBase: process.env.API_BASE || "http://localhost:4000/api",
    instructor: {
      email: instructorEmail,
      password,
      id: instructor._id.toString(),
      role: instructor.role,
    },
    student: {
      email: studentEmail,
      password,
      id: student._id.toString(),
      role: student.role,
    },
    course: {
      id: course._id.toString(),
      slug: course.slug,
      title: course.title,
    },
  };

  fs.writeFileSync(outFile, JSON.stringify(artifacts, null, 2), "utf8");
  console.log("✅ Seeded dev data");
  console.log("✅ Wrote artifacts:", outFile);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Seed error:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
