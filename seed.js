/* seed.js — demo data seeder */
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./backend/db");
const { Course, Quiz, QuizResult } = require("./backend/models");

// Minimal stand-in models (only for seeding; ignored if you already have them)
const Instructor = mongoose.models.Instructor || mongoose.model(
  "Instructor",
  new mongoose.Schema(
    { _id: mongoose.Schema.Types.ObjectId, name: String, email: String },
    { timestamps: true }
  )
);

const User = mongoose.models.User || mongoose.model(
  "User",
  new mongoose.Schema(
    { _id: mongoose.Schema.Types.ObjectId, name: String, email: String },
    { timestamps: true }
  )
);

const INSTRUCTOR_ID = new mongoose.Types.ObjectId("650000000000000000000001");
const USER_ID       = new mongoose.Types.ObjectId("650000000000000000000002");
const MONGO_URI     = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/microcourse";

function keyOf(o) {
  if (!o) return "";
  if (o.id != null) return String(o.id);
  if (o._id != null) return String(o._id);
  if (o.text != null) return String(o.text);
  return "";
}

async function main() {
  console.log("Connecting to", MONGO_URI);
  await connectDB(MONGO_URI);

  // Upsert demo instructor & user
  const [instructor, user] = await Promise.all([
    Instructor.findByIdAndUpdate(
      INSTRUCTOR_ID,
      { _id: INSTRUCTOR_ID, name: "Demo Instructor", email: "instructor@example.com" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    User.findByIdAndUpdate(
      USER_ID,
      { _id: USER_ID, name: "Demo Learner", email: "learner@example.com" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ]);

  // Upsert a course
  const course = await Course.findOneAndUpdate(
    { title: "Demo Course" },
    {
      title: "Demo Course",
      description: "Sample course seeded for backend E2E testing.",
      language: "en",
      level: "beginner",
      tags: ["demo", "seed"],
      instructorId: String(INSTRUCTOR_ID),
      published: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Upsert a quiz for the course
  let quiz = await Quiz.findOne({ title: "Demo Quiz", courseId: String(course._id) });
  if (!quiz) {
    quiz = await Quiz.create({
      title: "Demo Quiz",
      courseId: String(course._id),
      questions: [
        {
          prompt: "2 + 2 = ?",
          type: "single",
          points: 1,
          options: [
            { id: "a", text: "3", correct: false },
            { id: "b", text: "4", correct: true  },
            { id: "c", text: "5", correct: false },
          ],
        },
        {
          prompt: "Select vowels",
          type: "multi",
          points: 2,
          meta: { partial: "ratio" }, // your grader supports partial credit
          options: [
            { id: "a", text: "a", correct: true  },
            { id: "b", text: "b", correct: false },
            { id: "e", text: "e", correct: true  },
          ],
        },
        {
          prompt: "Spell 'graphite' lowercase",
          type: "short",
          points: 1,
          options: [{ id: "ok", text: "graphite", correct: true }],
        },
        {
          prompt: "Value of π to 2dp",
          type: "numeric",
          points: 2,
          meta: { tolerance: 0.01 },
          options: [{ id: "pi", text: "3.14", correct: true }],
        },
      ],
      settings: { timeLimitSec: 120, shuffle: false, attempts: 3 },
    });
  }

  // Build a perfect submission -> compute graded result (matches your grader logic)
  const breakdown = [];
  let correctCount = 0;
  let totalCount   = quiz.questions.length;
  let score        = 0;
  let maxPoints    = 0;

  for (const q of quiz.questions) {
    const points = typeof q.points === "number" ? q.points : 1;
    maxPoints += points;

    const correctOpts = (q.options || []).filter(o => o && o.correct);
    let correct = false;
    let awarded = 0;
    let selected = [];
    let input;

    switch (q.type) {
      case "single":
      case "truefalse":
        selected = [ keyOf(correctOpts[0]) ];
        correct = true;
        awarded = points;
        break;
      case "multi":
        selected = correctOpts.map(keyOf);
        correct = true;
        awarded = points;
        break;
      case "short":
        input = String(correctOpts[0]?.text ?? "");
        correct = true;
        awarded = points;
        break;
      case "numeric":
        input = Number(correctOpts[0]?.text ?? NaN);
        correct = true;
        awarded = points;
        break;
      default:
        correct = false;
        awarded = 0;
    }

    if (correct) correctCount += 1;
    score += awarded;

    breakdown.push({
      questionId: String(q._id),
      correct,
      selected,
      input,
      awarded,
    });
  }

  const percentage = maxPoints > 0 ? (score / maxPoints) * 100 : 0;

  // Upsert a QuizResult (one per user/quiz)
  const result = await QuizResult.findOneAndUpdate(
    { quizId: String(quiz._id), userId: String(USER_ID) },
    {
      quizId: String(quiz._id),
      userId: String(USER_ID),
      score,
      percentage,
      correctCount,
      totalCount,
      startedAt: new Date(Date.now() - 60 * 1000),
      submittedAt: new Date(),
      breakdown,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Seed complete ✅");
  console.table([
    { key: "InstructorId", value: String(INSTRUCTOR_ID) },
    { key: "UserId",       value: String(USER_ID) },
    { key: "CourseId",     value: String(course._id) },
    { key: "QuizId",       value: String(quiz._id) },
    { key: "ResultId",     value: String(result._id) },
    { key: "Score/Max",    value: `${score}/${maxPoints}` },
    { key: "Percent",      value: percentage.toFixed(2) + "%" },
  ]);

  await mongoose.connection.close();
}
main().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
