/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

const Course = require("../src/models/Course");
const Quiz = require("../src/models/Quiz");

function makeQuiz(n, courseId, createdByEmail) {
  return {
    courseId,
    title: `Pagination Seed Quiz #${n}`,
    instructions: "Auto-generated quiz for pagination testing.",
    createdByEmail: createdByEmail || "seed@local",
    questions: [
      {
        prompt: `Seed question A (#${n})`,
        options: ["A", "B", "C", "D"],
        answerIndex: 0,
        explanation: "A is correct",
      },
      {
        prompt: `Seed question B (#${n})`,
        options: ["1", "2", "3", "4"],
        answerIndex: 1,
        explanation: "2 is correct",
      },
      {
        prompt: `Seed question C (#${n})`,
        options: ["True", "False"],
        answerIndex: 0,
        explanation: "True is correct",
      },
    ],
  };
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGO_URI (or MONGODB_URI) in environment.");
    process.exit(1);
  }
  await mongoose.connect(uri);

  let course = await Course.findOne({ status: "published" }).lean();
  if (!course) {
    // If none published, publish the first course (dev-friendly)
    const first = await Course.findOne({}).lean();
    if (!first) {
      console.error("No courses exist. Create a course first.");
      process.exit(1);
    }
    await Course.updateOne({ _id: first._id }, { $set: { status: "published" } });
    course = await Course.findById(first._id).lean();
    console.log("No published course existed; published first course:", String(course._id));
  }

  const courseId = course._id;
  const ownerEmail = (course.createdByEmail || "").toLowerCase();

  // ensure >= 5 quizzes total for that course
  const existingCount = await Quiz.countDocuments({ courseId });
  const target = 5;
  const toCreate = Math.max(0, target - existingCount);

  if (toCreate === 0) {
    console.log("Seed not needed. Quizzes already =", existingCount);
    await mongoose.disconnect();
    return;
  }

  const docs = [];
  for (let i = 1; i <= toCreate; i++) docs.push(makeQuiz(existingCount + i, courseId, ownerEmail));

  await Quiz.insertMany(docs);
  console.log(`Seeded ${toCreate} quizzes for courseId=${String(courseId)} (total now ${existingCount + toCreate})`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
