/* scripts/fix-quizzes.js */
import mongoose from "mongoose";

const uri = process.env.MONGO_URL || process.env.MONGO_URI;
if (!uri) {
  console.error("❌ MONGO_URL / MONGO_URI not set.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri, { dbName: "microcourse" });
  const db = mongoose.connection.db;
  const quizzes = db.collection("quizzes");

  const cur = quizzes.find({ $or: [{ items: { $exists: false } }, { items: null }] });
  const toFix = await cur.toArray();
  console.log(`Found ${toFix.length} quiz(es) missing 'items'.`);

  let updates = 0;
  for (const q of toFix) {
    // Minimal default items derived from any 'questions' field if present,
    // otherwise provide two placeholder items.
    const fromQuestions = Array.isArray(q.questions)
      ? q.questions.map((x, idx) => ({
          type: "mc",
          prompt: x.q ?? `Question ${idx + 1}`,
          choices: (x.choices && Array.isArray(x.choices) && x.choices.length ? x.choices : ["A","B","C","D"]),
          answer: x.a ?? "A"
        }))
      : [];

    const items = fromQuestions.length
      ? fromQuestions
      : [
          { type: "mc", prompt: "Sample question 1", choices: ["A","B","C","D"], answer: "A" },
          { type: "mc", prompt: "Sample question 2", choices: ["True","False"], answer: "True" }
        ];

    await quizzes.updateOne(
      { _id: q._id },
      { $set: { items }, $unset: { questions: "" } } // normalize: prefer 'items' over legacy 'questions'
    );
    updates++;
  }

  console.log(`✅ Updated ${updates} quiz(es).`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("❌ fix-quizzes failed:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
