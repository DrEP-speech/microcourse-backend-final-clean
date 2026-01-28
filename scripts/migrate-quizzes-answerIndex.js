/* eslint-disable no-console */
const mongoose = require("mongoose");
require("dotenv").config();

const Quiz = require("../src/models/Quiz");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  await mongoose.connect(uri);
  console.log("Connected");

  const cursor = Quiz.find({}).cursor();
  let touched = 0;

  for await (const quiz of cursor) {
    let changed = false;

    if (Array.isArray(quiz.questions)) {
      quiz.questions = quiz.questions.map((q) => {
        const qq = { ...q };
        if (qq.answerIndex === undefined && qq.correctIndex !== undefined) {
          qq.answerIndex = qq.correctIndex;
          changed = true;
        }
        if (qq.correctIndex !== undefined) {
          delete qq.correctIndex;
          changed = true;
        }
        // if still missing, default to 0 (but keep data consistent)
        if (qq.answerIndex === undefined) {
          qq.answerIndex = 0;
          changed = true;
        }
        return qq;
      });
    }

    if (changed) {
      await quiz.save();
      touched++;
    }
  }

  console.log(`Migration complete. Updated quizzes: ${touched}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
