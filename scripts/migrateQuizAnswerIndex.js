/**
 * scripts/migrateQuizAnswerIndex.js
 *
 * Normalizes legacy question fields:
 * - correctIndex / correctAnswerIndex -> answerIndex
 * Also removes legacy keys to keep the schema consistent.
 *
 * Usage:
 *   node scripts/migrateQuizAnswerIndex.js
 */

require("dotenv").config();

const Quiz = require("../src/models/Quiz");
const connectDB = require("../src/utils/connectDB");

function toInt(v) {
  if (v === undefined || v === null) return null;
  if (Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

(async () => {
  try {
    await connectDB();

    const cursor = Quiz.find({
      $or: [
        { "questions.answerIndex": { $exists: false } },
        { "questions.correctIndex": { $exists: true } },
        { "questions.correctAnswerIndex": { $exists: true } },
      ],
    }).cursor();

    let scanned = 0;
    let updated = 0;

    for await (const quiz of cursor) {
      scanned++;

      let changed = false;

      const newQuestions = (quiz.questions || []).map((q) => {
        const next = { ...q.toObject?.() || q };

        // Map legacy fields -> answerIndex
        const ai = toInt(next.answerIndex);
        if (ai === null) {
          const legacy = toInt(next.correctIndex) ?? toInt(next.correctAnswerIndex);
          if (legacy !== null) {
            next.answerIndex = legacy;
            changed = true;
          }
        }

        // Remove legacy keys if present
        if (next.correctIndex !== undefined) {
          delete next.correctIndex;
          changed = true;
        }
        if (next.correctAnswerIndex !== undefined) {
          delete next.correctAnswerIndex;
          changed = true;
        }

        return next;
      });

      if (changed) {
        quiz.questions = newQuestions;
        // Avoid failing migration on unrelated validation edge cases
        await quiz.save({ validateBeforeSave: false });
        updated++;
      }
    }

    console.log(`✅ migrateQuizAnswerIndex: scanned=${scanned} updated=${updated}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ migrateQuizAnswerIndex failed:", err?.message || err);
    process.exit(1);
  }
})();
