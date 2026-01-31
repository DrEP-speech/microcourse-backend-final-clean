require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { connectDB } = require("../../config/db");

// Adjust these requires if your model paths differ
const User = require("../../models/User");
const Course = require("../../models/Course");
const Lesson = require("../../models/Lesson");
const Quiz = require("../../models/Quiz");

async function main() {
  await connectDB();

  const email = process.env.SEED_STUDENT_EMAIL || "student1@microcourse.dev";
  const password = process.env.SEED_STUDENT_PASSWORD || "Student123!";

  let student = await User.findOne({ email });
  if (!student) {
    const hash = await bcrypt.hash(password, 10);
    student = await User.create({
      name: "Seed Student",
      email,
      password: hash,
      role: "student"
    });
  }

  // Create a course if none exists
  let course = await Course.findOne({ slug: "onboarding" });
  if (!course) {
    course = await Course.create({
      title: "Onboarding Course",
      slug: "onboarding",
      description: "Welcome to MicroCourse. This is the onboarding track."
    });
  }

  // Create a lesson
  let lesson = await Lesson.findOne({ courseId: course._id, order: 1 });
  if (!lesson) {
    lesson = await Lesson.create({
      courseId: course._id,
      title: "Welcome Lesson",
      order: 1,
      content: "Welcome to MicroCourse!"
    });
  }

  // Create a quiz
  let quiz = await Quiz.findOne({ courseId: course._id, lessonId: lesson._id, title: "Onboarding Quiz" });
  if (!quiz) {
    quiz = await Quiz.create({
      courseId: course._id,
      lessonId: lesson._id,
      title: "Onboarding Quiz",
      questions: [
        {
          prompt: "What is MicroCourse?",
          options: ["A micro-learning LMS", "A toaster manual", "A car part", "A music album"],
          correctIndex: 0
        }
      ]
    });
  }

  console.log("[seed] ✅ Student:", email);
  console.log("[seed] ✅ Password:", password);
  console.log("[seed] ✅ Course:", course._id.toString());
  console.log("[seed] ✅ Lesson:", lesson._id.toString());
  console.log("[seed] ✅ Quiz:", quiz._id.toString());

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error("[seed] ❌", err);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});