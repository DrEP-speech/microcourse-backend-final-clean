/* eslint-disable no-console */
const mongoose = require("mongoose");
require("dotenv").config();

const Quiz = require("../src/models/Quiz");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const courseId = process.env.COURSE_ID;
  const createdByEmail = (process.env.CREATED_BY_EMAIL || "instructor@demo.local").toLowerCase();

  if (!uri) throw new Error("Missing MONGODB_URI (or MONGO_URI)");
  if (!courseId) throw new Error("Missing COURSE_ID env");

  await mongoose.connect(uri);
  console.log("Connected");

  const baseQuestions = [
    {
      prompt: "What page shows your enrolled courses?",
      options: ["Dashboard", "Admin", "Profile", "Settings"],
      answerIndex: 0,
      explanation: "Students land on Dashboard for courses and progress."
    },
    {
      prompt: "Which action submits a quiz attempt?",
      options: ["GET /results/me", "POST /results/submit", "PUT /quizzes/:id", "DELETE /courses/:id"],
      answerIndex: 1,
      explanation: "Submitting attempts uses POST /results/submit."
    }
  ];

  const existingCount = await Quiz.countDocuments({ courseId });
  const toCreate = Math.max(0, 6 - existingCount); // ensure at least 6 quizzes

  if (toCreate === 0) {
    console.log("Seed not needed: enough quizzes already exist.");
    await mongoose.disconnect();
    return;
  }

  const now = Date.now();
  const docs = [];
  for (let i = 0; i < toCreate; i++) {
    docs.push({
      courseId,
      title: `Pagination Exercise Quiz ${existingCount + i + 1}`,
      instructions: "Seed quiz to test pagination and submit flow.",
      questions: baseQuestions,
      createdByEmail,
      createdAt: new Date(now - i * 60_000),
      updatedAt: new Date(now - i * 60_000),
    });
  }

  await Quiz.insertMany(docs);
  console.log(`Seed complete. Inserted: ${docs.length}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
