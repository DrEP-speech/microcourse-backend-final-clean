require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGODB_URI (or MONGO_URI) in .env");
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("Invalid Mongo URI scheme. Must start with mongodb:// or mongodb+srv://");
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const now = new Date();
  const instructorEmail = "instructor1@demo.local";
  const studentEmail = "student1@demo.local";

  // ----- Course -----
  const courseId = new mongoose.Types.ObjectId();
  const quizId = new mongoose.Types.ObjectId();

  const course = {
    _id: courseId,
    title: "MicroCourse: How to Use the MicroCourse App (Customer Walkthrough)",
    slug: "how-to-use-the-app",
    description:
      "A practical guided tour: login → dashboards → take quizzes → review results → understand insights. Built as a real sample course for your production demo.",
    category: "Onboarding",
    level: "Beginner",
    status: "published",
    instructorEmail,
    tags: ["onboarding", "how-to", "microcourse", "quiz"],
    modules: [
      {
        title: "Module 1 — Getting Started",
        order: 1,
        lessons: [
          {
            _id: new mongoose.Types.ObjectId(),
            title: "Lesson 1: Logging In + Roles (Instructor vs Student)",
            order: 1,
            type: "reading",
            content:
              "Goal: understand accounts and roles. Tip: If a route returns 401, you likely forgot the Bearer token.",
            followUpQuestions: [
              "What is the difference between a student dashboard and an instructor dashboard?",
              "Where do you find your JWT token after login?",
              "What does 'Bearer' mean in Authorization headers?"
            ]
          },
          {
            _id: new mongoose.Types.ObjectId(),
            title: "Lesson 2: The Course Library + Navigation",
            order: 2,
            type: "reading",
            content:
              "Goal: browse courses and open one. A course is composed of modules, and modules are composed of lessons.",
            followUpQuestions: [
              "Why do we store 'slug' in addition to 'title'?",
              "What fields should exist for a course to be 'sellable-ready'?",
              "What is the difference between 'draft' and 'published'?"
            ]
          }
        ]
      },
      {
        title: "Module 2 — Quizzes, Results, and Insights",
        order: 2,
        lessons: [
          {
            _id: new mongoose.Types.ObjectId(),
            title: "Lesson 3: Taking a Quiz + Submitting Answers",
            order: 1,
            type: "reading",
            content:
              "Goal: take quizzes, submit answers, then learn from missed concepts using the review + insight panels.",
            followUpQuestions: [
              "What should happen after quiz submission (UX)?",
              "Why is it better to store 'missedConcepts' as tags than only raw text?",
              "What data is needed to draw a performance chart?"
            ],
            quizId
          }
        ]
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  // ----- Quiz -----
  const quiz = {
    _id: quizId,
    courseId,
    title: "Quiz: Using the App Like a Pro",
    instructions: "Answer each question. You can review missed concepts afterward.",
    passingScore: 80,
    timeLimitMin: 10,
    questions: [
      {
        _id: new mongoose.Types.ObjectId(),
        type: "mcq",
        prompt: "Which header is required to access protected routes?",
        choices: [
          "X-Auth: <token>",
          "Authorization: Bearer <token>",
          "Token: <token>",
          "Cookie: session=<token>"
        ],
        answerIndex: 1,
        explanation: "Protected endpoints typically require Authorization: Bearer <JWT>.",
        tags: ["auth", "jwt"]
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: "mcq",
        prompt: "A MongoDB connection string must start with which scheme?",
        choices: ["http://", "file://", "mongodb:// or mongodb+srv://", "ssh://"],
        answerIndex: 2,
        explanation: "Mongoose expects mongodb:// or mongodb+srv://.",
        tags: ["mongodb", "mongoose"]
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: "mcq",
        prompt: "In Express, why does Router.use() throw 'requires a middleware function'?",
        choices: [
          "Because the route file is too big",
          "Because require() returned an object, not a function",
          "Because the port is already in use",
          "Because JSON parsing is disabled"
        ],
        answerIndex: 1,
        explanation: "If module.exports is { requireAuth }, then require() returns an object, not the middleware function itself.",
        tags: ["express", "middleware"]
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: "mcq",
        prompt: "Why must '/suggested' be defined BEFORE '/:quizId'?",
        choices: [
          "So it loads faster",
          "So caching works",
          "So 'suggested' is not treated as a quizId parameter",
          "It doesn't matter"
        ],
        answerIndex: 2,
        explanation: "Otherwise Express will match 'suggested' to :quizId and you may trigger ObjectId casts.",
        tags: ["routing", "express"]
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  // ----- Seed results for charts/insights -----
  const results = [];
  const sampleScores = [60, 75, 85, 90, 70, 95, 88];
  for (let i = 0; i < sampleScores.length; i++) {
    const createdAt = new Date(Date.now() - (sampleScores.length - i) * 24 * 60 * 60 * 1000);
    const score = sampleScores[i];
    const totalCount = 4;
    const correctCount = Math.round((score / 100) * totalCount);

    results.push({
      _id: new mongoose.Types.ObjectId(),
      userEmail: studentEmail,
      instructorEmail,
      courseId,
      quizId,
      score,
      correctCount,
      totalCount,
      missedConcepts: score < 80 ? ["jwt", "mongodb"] : [],
      createdAt,
      updatedAt: createdAt
    });
  }

  // Upsert course + quiz (id-stable), replace results fresh
  await db.collection("courses").deleteMany({ slug: course.slug });
  await db.collection("courses").insertOne(course);

  await db.collection("quizzes").deleteMany({ courseId });
  await db.collection("quizzes").insertOne(quiz);

  // results collections can vary; write to the common one(s)
  const resultCollections = ["quizresults", "quizResults", "results"];
  for (const col of resultCollections) {
    try {
      await db.collection(col).deleteMany({ userEmail: studentEmail, courseId });
      await db.collection(col).insertMany(results);
    } catch (_) {}
  }

  console.log("✅ Seed complete:");
  console.log("CourseId:", String(courseId));
  console.log("QuizId  :", String(quizId));
  console.log("Student :", studentEmail);
  console.log("Instructor:", instructorEmail);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e.message);
  process.exit(1);
});
