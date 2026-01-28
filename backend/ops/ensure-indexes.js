require("dotenv").config();
const mongoose = require("mongoose");
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/microcourse";

(async () => {
  await mongoose.connect(uri, { dbName: undefined });
  const db = mongoose.connection.db;

  // Collections (your schema names)
  const results = db.collection("results");
  const quizzes = db.collection("quizzes");
  const courses = db.collection("courses");

  // 1) Prevent duplicate submissions: (quizId,userId) unique
  await results.createIndex({ quizId: 1, userId: 1 }, { unique: true, name: "uniq_result_per_quiz_user" });
  // 2) Fast lookup for last quiz, optional
  await quizzes.createIndex({ updatedAt: -1 }, { name: "quizzes_updatedAt_desc" });
  // 3) Helpful title index (non-unique)
  await quizzes.createIndex({ title: 1 }, { name: "quizzes_title" });

  console.log("Indexes created ✅");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
