require("dotenv").config({ override: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Quiz = require("../models/Quiz");

async function run() {
  const conn = await connectDB();
  console.log("✅ Mongo connected:", conn);

  await Promise.all([
    Course.deleteMany({}),
    Lesson.deleteMany({}),
    Quiz.deleteMany({}),
  ]);

  const courses = await Course.insertMany([
    {
      title: "Speech Structure: From Outline to Delivery",
      description: "Build speeches that land: thesis, signposting, cadence, and close.",
      category: "Communication",
      level: "Beginner",
      tags: ["speech","structure","delivery"],
      priceCents: 4900,
      published: true,
    },
    {
      title: "Clinical Documentation: SOAP Notes That Survive Audits",
      description: "Write documentation that's clear, defensible, and fast.",
      category: "Healthcare",
      level: "Intermediate",
      tags: ["soap","clinical","compliance"],
      priceCents: 6900,
      published: true,
    },
  ]);

  const [c1, c2] = courses;

  await Lesson.insertMany([
    { courseId: c1._id, title: "The Thesis: One Sentence to Rule Them All", content: "A thesis is the central claim.", durationMinutes: 6, order: 1, published: true },
    { courseId: c1._id, title: "Signposting: Don’t Make People Guess", content: "Tell them where you’re going.", durationMinutes: 7, order: 2, published: true },
    { courseId: c2._id, title: "SOAP: Subjective, Objective, Assessment, Plan", content: "Document with clinical logic.", durationMinutes: 8, order: 1, published: true },
    { courseId: c2._id, title: "Audit-Proof Language", content: "Avoid vague claims; show evidence.", durationMinutes: 9, order: 2, published: true },
  ]);

  await Quiz.insertMany([
    {
      courseId: c1._id,
      title: "Speech Structure Quiz",
      description: "",
      status: "published",
      passingScore: 70,
      timeLimitMinutes: 10,
      published: true,
      items: [
        { type: "mc", prompt: "Three-act structure?", choices: ["A","B","C","D"], answer: "Beginning, middle, end", explanation: "Classic structure.", points: 1 },
        { type: "mc", prompt: "Define thesis statement", choices: ["A","B","C","D"], answer: "Central claim of a speech", explanation: "The thesis anchors the talk.", points: 1 },
      ],
    },
    {
      courseId: c2._id,
      title: "SOAP Notes Quiz",
      description: "",
      status: "published",
      passingScore: 70,
      timeLimitMinutes: 10,
      published: true,
      items: [
        { type: "short", prompt: "What does SOAP stand for?", choices: [], answer: "Subjective, Objective, Assessment, Plan", explanation: "Standard format.", points: 2 },
      ],
    },
  ]);

  console.log("✅ Seed complete");
  console.log("Courses:", await Course.countDocuments({}));
  console.log("Lessons:", await Lesson.countDocuments({}));
  console.log("Quizzes:", await Quiz.countDocuments({}));

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (e) => {
  console.error("❌ Seed failed:", e?.message || e);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
