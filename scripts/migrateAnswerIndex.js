/**
 * Migration: normalize legacy correctIndex -> answerIndex
 * - If answerIndex missing but correctIndex exists, copy it
 * - Optionally remove correctIndex
 */
require("dotenv").config();

const mongoose = require("mongoose");
const Quiz = require("../src/models/Quiz");

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  if (!MONGO) {
    console.error("Missing MONGODB_URI (or MONGO_URI) in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO);
  console.log("MongoDB connected");

  const quizzes = await Quiz.find({}).select("_id questions").lean();
  console.log(`Found ${quizzes.length} quizzes`);

  const ops = [];

  for (const qz of quizzes) {
    if (!Array.isArray(qz.questions) || qz.questions.length === 0) continue;

    let changed = false;
    const newQuestions = qz.questions.map((q) => {
      const qq = { ...q };

      // If schema stores Mongoose subdocs, answerIndex might be undefined
      const hasAnswer = Number.isInteger(qq.answerIndex);
      const hasCorrect = Number.isInteger(qq.correctIndex);

      if (!hasAnswer && hasCorrect) {
        qq.answerIndex = qq.correctIndex;
        changed = true;
      }

      // Clean up legacy field if you want:
      if (qq.correctIndex !== undefined) {
        delete qq.correctIndex;
        changed = true;
      }

      return qq;
    });

    if (changed) {
      ops.push({
        updateOne: {
          filter: { _id: qz._id },
          update: { $set: { questions: newQuestions } }
        }
      });
    }
  }

  if (ops.length === 0) {
    console.log("No changes needed.");
  } else {
    const r = await Quiz.bulkWrite(ops);
    console.log("Updated quizzes:", r.modifiedCount || 0);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
