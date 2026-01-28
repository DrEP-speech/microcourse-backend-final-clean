const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { connectDB } = require("../src/utils/connectDB");

const User = require("../src/models/User");
const Course = require("../src/models/Course");
const Lesson = require("../src/models/Lesson");
const Quiz = require("../src/models/Quiz");

function fallbackSlug(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function run() {
  await connectDB();

  const instructorEmail = "instructor1@demo.local";
  const studentEmail = "student1@demo.local";
  const password = "Password123!";

  const passwordHash = await bcrypt.hash(password, 10);

  await User.updateOne(
    { email: instructorEmail },
    { $set: { email: instructorEmail, passwordHash, role: "instructor" } },
    { upsert: true }
  );

  await User.updateOne(
    { email: studentEmail },
    { $set: { email: studentEmail, passwordHash, role: "student" } },
    { upsert: true }
  );

  const title = "MicroCourse Forge: Use the App Like a Pro";
  const slug = fallbackSlug(title);

  const course = await Course.findOneAndUpdate(
    { slug },
    {
      $set: {
        title,
        slug,
        description:
          "A built-in onboarding microcourse that teaches new users how to navigate the platform, publish a course, and verify learning with a quiz.",
        instructorEmail,
        status: "published"
      }
    },
    { upsert: true, new: true }
  );

  await Lesson.deleteMany({ courseId: course._id });

  const lessons = [
    {
      title: "Lesson 1 — The Dashboard Map",
      order: 1,
      content:
        "Learn the layout: Courses list, Create Course, Lesson Editor, Quiz area, and Results. Goal: you should know where everything lives in under 60 seconds."
    },
    {
      title: "Lesson 2 — Creating a Course (Clean + Publishable)",
      order: 2,
      content:
        "Create a course with a title, description, and status. Tip: keep titles concrete and outcome-focused. Published courses show up for students."
    },
    {
      title: "Lesson 3 — Lessons: Where They Live and How They Order",
      order: 3,
      content:
        "Lessons live under a course. Each lesson has an order number. Lower numbers appear first. Add content and optional video URL."
    },
    {
      title: "Lesson 4 — Quizzes and Results (Proof of Learning)",
      order: 4,
      content:
        "Quizzes attach to a course. Students submit answers. Results store score, percent, and timestamps. Insights can summarize weak areas."
    }
  ];

  await Lesson.insertMany(
    lessons.map((l) => ({
      courseId: course._id,
      title: l.title,
      order: l.order,
      content: l.content,
      videoUrl: ""
    }))
  );

  await Quiz.deleteMany({ courseId: course._id });

  const quiz = await Quiz.create({
    courseId: course._id,
    title: "Quiz — Using the App Like a Pro (Follow-Up Questions)",
    instructions: "Answer each question. Then review your missed items and retake for improvement.",
    questions: [
      {
        prompt: "Where do lessons live in the system?",
        options: [
          "Inside the course (courseId links lessons to the course)",
          "Inside the quiz only",
          "Only in the frontend; backend doesn’t store lessons",
          "In the auth module"
        ],
        answerIndex: 0,
        explanation: "Lessons are stored in the Lesson model with courseId referencing the Course."
      },
      {
        prompt: "What does 'published' typically mean in Courses?",
        options: [
          "Visible to students by default",
          "Only visible to admins",
          "Deleted after 24 hours",
          "Requires a quiz result to exist first"
        ],
        answerIndex: 0,
        explanation: "Published courses are usually the ones shown in the public/student catalog."
      },
      {
        prompt: "Which endpoint is the correct base for courses on this backend?",
        options: ["/api/courses", "/courses", "/api/course", "/v1/courses"],
        answerIndex: 0,
        explanation: "Your server mounts courseRoutes at /api/courses."
      },
      {
        prompt: "What happens when a student submits a quiz?",
        options: [
          "A QuizResult is created with score + percent",
          "The quiz is deleted",
          "The course is unpublished",
          "Nothing is stored"
        ],
        answerIndex: 0,
        explanation: "Results persist attempt data so progress can be tracked over time."
      },
      {
        prompt: "If MONGODB_URI exists but the app says it's missing, the most likely cause is…",
        options: [
          "dotenv was not loaded in that script/process context",
          "MongoDB can’t run on localhost",
          "Express doesn’t support .env",
          "JWT_SECRET overrides it"
        ],
        answerIndex: 0,
        explanation: "Seed scripts must load dotenv too, not just server.js."
      },
      {
        prompt: "Which file is responsible for mounting all route modules?",
        options: ["server.js", "Course.js", "Lesson.js", "package.json"],
        answerIndex: 0,
        explanation: "server.js calls safeMount('/api/...', './src/routes/...')."
      }
    ]
  });

  console.log("Seed complete.");
  console.log("Course:", course.title, String(course._id));
  console.log("Quiz:", quiz.title, String(quiz._id));
  console.log("Demo instructor login:", instructorEmail, password);
  console.log("Demo student login:", studentEmail, password);

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});

