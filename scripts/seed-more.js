/* scripts/seed-more.js */
import mongoose from "mongoose";

const uri = process.env.MONGO_URL || process.env.MONGO_URI;
if (!uri) {
  console.error("❌ MONGO_URL / MONGO_URI not set.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri, { dbName: "microcourse" });
  const db = mongoose.connection.db;

  const users   = db.collection("users");
  const courses = db.collection("courses");
  const quizzes = db.collection("quizzes");
  const results = db.collection("results");

  const [u,c,q,r] = await Promise.all([
    users.countDocuments(), courses.countDocuments(), quizzes.countDocuments(), results.countDocuments()
  ]);

  console.log("🔎 Before:", { users:u, courses:c, quizzes:q, results:r });

  const anyUser = await users.findOne({}, { projection: { _id: 1, email: 1 } });

  // COURSES
  if (c === 0) {
    const now = new Date();
    await courses.insertMany([
      { title:"Intro to Public Speaking", slug:"intro-public-speaking", description:"Overcome stage fright.", level:"beginner", published:true, createdAt:now, updatedAt:now },
      { title:"Speech Writing Essentials", slug:"speech-writing-essentials", description:"Structure & storytelling.", level:"intermediate", published:true, createdAt:now, updatedAt:now },
    ]);
    console.log("✅ Seeded courses");
  }

  // QUIZZES
  const curCourses = await courses.find({}, { projection:{ _id:1 } }).toArray();
  if (q === 0 && curCourses.length) {
    const now = new Date();
    await quizzes.insertMany([
      {
        courseId: curCourses[0]._id,
        title: "Public Speaking Basics Quiz",
        items: [
          { type: "mc", prompt: "What is key in an opening?", choices: ["Hook","Data","Apology","Agenda"], answer: "Hook" },
          { type: "mc", prompt: "One way to reduce stage fright?", choices: ["Deep breathing","Skip rehearsal","Read slides only","Whisper"], answer: "Deep breathing" }
        ],
        published: true, createdAt: now, updatedAt: now
      },
      {
        courseId: curCourses[1]?._id ?? curCourses[0]._id,
        title: "Speech Structure Quiz",
        items: [
          { type: "mc", prompt: "Three-act structure?", choices: ["Intro/Middle/Outro","Beginning/Middle/End","Hook/Body/Q&A","Problem/Solution"], answer: "Beginning/Middle/End" },
          { type: "mc", prompt: "Define thesis statement", choices: ["Central claim of a speech","Audience Q&A","Visual aid","Reference list"], answer: "Central claim of a speech" }
        ],
        published: true, createdAt: now, updatedAt: now
      }
    ]);
    console.log("✅ Seeded quizzes (with items)");
  }
  // RESULTS
  const curQuizzes = await quizzes.find({}, { projection:{ _id:1 } }).toArray();
  if (r === 0 && curQuizzes.length) {
    const now = new Date();
    await results.insertMany([
      { quizId: curQuizzes[0]._id, userId: anyUser?._id ?? null, score:90, correct:9, total:10, createdAt:now, updatedAt:now },
      { quizId: curQuizzes[1]?._id ?? curQuizzes[0]._id, userId: anyUser?._id ?? null, score:80, correct:8, total:10, createdAt:now, updatedAt:now }
    ]);
    console.log("✅ Seeded results");
  }

  const [u2,c2,q2,r2] = await Promise.all([
    users.countDocuments(), courses.countDocuments(), quizzes.countDocuments(), results.countDocuments()
  ]);
  console.log("📊 After:", { users:u2, courses:c2, quizzes:q2, results:r2 });

  await mongoose.disconnect();
  console.log("✅ Seed-more complete");
}
main().catch(async (e) => {
  console.error("❌ Seed-more failed:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

