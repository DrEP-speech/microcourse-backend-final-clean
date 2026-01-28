Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "=== MICROCOURSE BACKEND: CLEAN CONSOLIDATION PACK ===" -ForegroundColor Cyan

# ---------------------------
# 0) Folder sanity
# ---------------------------
$root = Get-Location
New-Item -ItemType Directory -Force -Path ".\src\routes",".\src\models",".\src\middleware",".\src\utils",".\scripts",".\_quarantine",".\routes" | Out-Null

# ---------------------------
# 1) Quarantine files that look like Next.js route handlers inside backend
#    (These break Express mounts)
# ---------------------------
$badPatterns = @("next/server","NextResponse","use server","export const GET","export async function GET","app\/api","route.ts")
$files = Get-ChildItem -Recurse -File -Include *.js,*.ts,*.mjs,*.cjs -ErrorAction SilentlyContinue

$toMove = @()
foreach ($f in $files) {
  try {
    $hit = Select-String -Path $f.FullName -Pattern $badPatterns -SimpleMatch -Quiet
    if ($hit -and ($f.FullName -notmatch "\\node_modules\\") -and ($f.FullName -notmatch "\\_quarantine\\")) {
      $toMove += $f
    }
  } catch {}
}

foreach ($f in $toMove) {
  $dest = Join-Path ".\_quarantine" ($f.FullName.Substring($root.Path.Length).TrimStart("\"))
  $destDir = Split-Path $dest -Parent
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  Move-Item -Force $f.FullName $dest
  Write-Host ("Quarantined: " + $f.FullName) -ForegroundColor Yellow
}

# ---------------------------
# 2) Write .env (safe defaults; you MUST put a real Mongo URI)
# ---------------------------
if (-not (Test-Path ".\.env")) {
@'
PORT=4000
JWT_SECRET=dev_secret_change_me

# ✅ Use ONE of these formats:
# Local:
# MONGODB_URI=mongodb://127.0.0.1:27017/microcourse
# Atlas:
# MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/microcourse?retryWrites=true&w=majority

MONGODB_URI=mongodb://127.0.0.1:27017/microcourse
'@ | Set-Content -Encoding UTF8 ".\.env"
  Write-Host "Created .env with LOCAL mongo default (edit if using Atlas)." -ForegroundColor Green
} else {
  Write-Host ".env already exists (make sure MONGODB_URI is valid)." -ForegroundColor Yellow
}

# ---------------------------
# 3) server.js (single source of truth; mounts ONLY src/routes)
# ---------------------------
@'
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("./src/utils/connectDB");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "microcourse-backend", time: new Date().toISOString() });
});

function safeMount(path, routePath) {
  try {
    const mod = require(routePath);
    const router = mod && mod.handle ? mod : (mod && mod.default ? mod.default : mod);
    if (!router || typeof router !== "function") {
      throw new Error(`Module did not export an Express router function. Got: ${typeof router}`);
    }
    app.use(path, router);
    console.log("✅ Mounted", path);
  } catch (e) {
    console.error("❌ Failed mounting", path, "from", routePath, "\n", e.message);
    throw e;
  }
}

safeMount("/api/auth", "./src/routes/authRoutes");
safeMount("/api/courses", "./src/routes/courseRoutes");
safeMount("/api/quizzes", "./src/routes/quizRoutes");
safeMount("/api/results", "./src/routes/resultsRoutes");
safeMount("/api/insights", "./src/routes/insightsRoutes");

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`✅ Server listening on http://localhost:${PORT}`));
})();
'@ | Set-Content -Encoding UTF8 ".\server.js"

# ---------------------------
# 4) connectDB util (hard-stops with helpful message)
# ---------------------------
@'
const mongoose = require("mongoose");

function isValidMongoUri(uri) {
  return typeof uri === "string" && (uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"));
}

async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!isValidMongoUri(uri)) {
    console.error("❌ DB connect failed: MONGODB_URI must start with mongodb:// or mongodb+srv://");
    console.error("   Current value:", uri);
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("✅ Mongo connected");
}

module.exports = { connectDB };
'@ | Set-Content -Encoding UTF8 ".\src\utils\connectDB.js"

# ---------------------------
# 5) auth middleware (JWT)
# ---------------------------
@'
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, error: "Missing Bearer token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
'@ | Set-Content -Encoding UTF8 ".\src\middleware\auth.js"

# ---------------------------
# 6) Models
# ---------------------------
@'
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
'@ | Set-Content -Encoding UTF8 ".\src\models\User.js"

@'
const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    instructorEmail: { type: String, required: true },
    status: { type: String, enum: ["draft", "published"], default: "published" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", CourseSchema);
'@ | Set-Content -Encoding UTF8 ".\src\models\Course.js"

@'
const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 1 },
    content: { type: String, default: "" },
    videoUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lesson", LessonSchema);
'@ | Set-Content -Encoding UTF8 ".\src\models\Lesson.js"

@'
const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
    conceptTag: { type: String, default: "" },
    explanation: { type: String, default: "" }
  },
  { _id: false }
);

const QuizSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    instructions: { type: String, default: "" },
    questions: [QuestionSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", QuizSchema);
'@ | Set-Content -Encoding UTF8 ".\src\models\Quiz.js"

@'
const mongoose = require("mongoose");

const QuizResultSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    score: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    totalCount: { type: Number, required: true },
    missedConcepts: [{ type: String }],
    answers: [{ q: Number, selected: Number, correct: Boolean }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizResult", QuizResultSchema);
'@ | Set-Content -Encoding UTF8 ".\src\models\QuizResult.js"

# ---------------------------
# 7) Routes (ALL export router directly)
# ---------------------------
@'
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: "email+password required" });

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ ok: false, error: "User already exists" });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({
    email: String(email).toLowerCase(),
    passwordHash,
    role: role || "student"
  });

  res.json({ ok: true, user: { id: user._id, email: user.email, role: user.role } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: "email+password required" });

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const token = jwt.sign(
    { id: String(user._id), email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev_secret_change_me",
    { expiresIn: "7d" }
  );

  res.json({ ok: true, token, user: { id: user._id, email: user.email, role: user.role } });
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
'@ | Set-Content -Encoding UTF8 ".\src\routes\authRoutes.js"

@'
const express = require("express");
const slugify = require("slugify");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  const courses = await Course.find({ status: "published" }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, courses });
});

router.post("/", requireAuth, requireRole("instructor", "admin"), async (req, res) => {
  const { title, description, status } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: "title required" });

  const slug = slugify(String(title), { lower: true, strict: true });
  const course = await Course.create({
    title: String(title),
    slug,
    description: description || "",
    instructorEmail: req.user.email,
    status: status || "published"
  });

  res.json({ ok: true, course });
});

router.get("/:courseId", async (req, res) => {
  const course = await Course.findById(req.params.courseId).lean();
  if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, course });
});

router.get("/:courseId/lessons", async (req, res) => {
  const lessons = await Lesson.find({ courseId: req.params.courseId }).sort({ order: 1 }).lean();
  res.json({ ok: true, lessons });
});

router.post("/:courseId/lessons", requireAuth, requireRole("instructor", "admin"), async (req, res) => {
  const { title, order, content, videoUrl } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: "title required" });

  const lesson = await Lesson.create({
    courseId: req.params.courseId,
    title: String(title),
    order: Number(order || 1),
    content: content || "",
    videoUrl: videoUrl || ""
  });

  res.json({ ok: true, lesson });
});

module.exports = router;
'@ | Set-Content -Encoding UTF8 ".\src\routes\courseRoutes.js"

@'
const express = require("express");
const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  const { courseId } = req.query;
  const q = {};
  if (courseId && mongoose.Types.ObjectId.isValid(String(courseId))) q.courseId = courseId;
  const quizzes = await Quiz.find(q).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, quizzes });
});

router.get("/suggested", requireAuth, async (req, res) => {
  const userEmail = String(req.query.userEmail || req.user.email || "").toLowerCase();
  if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail required" });

  const last = await QuizResult.findOne({ userEmail }).sort({ createdAt: -1 }).lean();
  if (!last || !last.missedConcepts || last.missedConcepts.length === 0) {
    const latestQuiz = await Quiz.findOne({}).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, source: "latest", suggestedQuiz: latestQuiz || null });
  }

  const topMiss = last.missedConcepts[0];
  const candidate = await Quiz.findOne({ courseId: last.courseId, "questions.conceptTag": topMiss }).lean();
  if (candidate) return res.json({ ok: true, source: "missed-concept", suggestedQuiz: candidate });

  const fallback = await Quiz.findOne({ courseId: last.courseId }).sort({ createdAt: -1 }).lean();
  return res.json({ ok: true, source: "course-latest", suggestedQuiz: fallback || null });
});

router.get("/:quizId", async (req, res) => {
  const { quizId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(quizId)) return res.status(400).json({ ok: false, error: "Invalid quizId" });
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });
  res.json({ ok: true, quiz });
});

router.post("/", requireAuth, requireRole("instructor", "admin"), async (req, res) => {
  const { courseId, title, instructions, questions } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(String(courseId))) return res.status(400).json({ ok: false, error: "Valid courseId required" });
  if (!title) return res.status(400).json({ ok: false, error: "title required" });
  if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ ok: false, error: "questions[] required" });

  const quiz = await Quiz.create({
    courseId,
    title,
    instructions: instructions || "",
    questions
  });

  res.json({ ok: true, quiz });
});

router.post("/:quizId/submit", requireAuth, async (req, res) => {
  const { quizId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(quizId)) return res.status(400).json({ ok: false, error: "Invalid quizId" });

  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

  const userEmail = String((req.body && req.body.userEmail) || req.user.email || "").toLowerCase();
  const answers = Array.isArray(req.body && req.body.answers) ? req.body.answers : [];

  const total = quiz.questions.length;
  let correctCount = 0;
  const missedConcepts = [];
  const scoredAnswers = [];

  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const submitted = answers.find(a => Number(a.q) === i);
    const selected = submitted ? Number(submitted.selected) : -1;
    const correct = selected === q.correctIndex;
    if (correct) correctCount++;
    else if (q.conceptTag) missedConcepts.push(q.conceptTag);
    scoredAnswers.push({ q: i, selected, correct });
  }

  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  const result = await QuizResult.create({
    quizId: quiz._id,
    courseId: quiz.courseId,
    userEmail,
    score,
    correctCount,
    totalCount: total,
    missedConcepts,
    answers: scoredAnswers
  });

  res.json({
    ok: true,
    result: {
      id: result._id,
      score,
      correctCount,
      totalCount: total,
      missedConcepts
    }
  });
});

module.exports = router;
'@ | Set-Content -Encoding UTF8 ".\src\routes\quizRoutes.js"

@'
const express = require("express");
const QuizResult = require("../models/QuizResult");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function canView(req, userEmail) {
  if (!req.user) return false;
  if (req.user.role === "admin") return true;
  return String(req.user.email).toLowerCase() === String(userEmail).toLowerCase();
}

router.get("/", requireAuth, async (req, res) => {
  const userEmail = String(req.query.userEmail || "").toLowerCase();
  if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail required" });
  if (!canView(req, userEmail)) return res.status(403).json({ ok: false, error: "Forbidden" });

  const results = await QuizResult.find({ userEmail }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ ok: true, results });
});

router.get("/chart", requireAuth, async (req, res) => {
  const userEmail = String(req.query.userEmail || "").toLowerCase();
  const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));

  if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail required" });
  if (!canView(req, userEmail)) return res.status(403).json({ ok: false, error: "Forbidden" });

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await QuizResult.find({ userEmail, createdAt: { $gte: since } })
    .sort({ createdAt: 1 })
    .lean();

  const series = rows.map(r => ({ t: r.createdAt, score: r.score }));
  res.json({ ok: true, days, series });
});

module.exports = router;
'@ | Set-Content -Encoding UTF8 ".\src\routes\resultsRoutes.js"

@'
const express = require("express");
const QuizResult = require("../models/QuizResult");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function canView(req, userEmail) {
  if (!req.user) return false;
  if (req.user.role === "admin") return true;
  return String(req.user.email).toLowerCase() === String(userEmail).toLowerCase();
}

router.get("/latest", requireAuth, async (req, res) => {
  const userEmail = String(req.query.userEmail || req.user.email || "").toLowerCase();
  if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail required" });
  if (!canView(req, userEmail)) return res.status(403).json({ ok: false, error: "Forbidden" });

  const latest = await QuizResult.findOne({ userEmail }).sort({ createdAt: -1 }).lean();
  if (!latest) return res.json({ ok: true, insight: { message: "No results yet. Take a quiz to generate insights." } });

  const missed = latest.missedConcepts || [];
  const top = {};
  for (const c of missed) top[c] = (top[c] || 0) + 1;
  const topMissed = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);

  res.json({
    ok: true,
    insight: {
      latestScore: latest.score,
      lastTakenAt: latest.createdAt,
      topMissedConcepts: topMissed,
      recommendation: topMissed.length
        ? `Review: ${topMissed.join(", ")}`
        : "Nice work — no recurring missed concepts detected."
    }
  });
});

module.exports = router;
'@ | Set-Content -Encoding UTF8 ".\src\routes\insightsRoutes.js"

# ---------------------------
# 8) Back-compat shims (routes/*.js -> src/routes/*.js)
#    This neutralizes your duplicate-file landmine.
# ---------------------------
@'
module.exports = require("../src/routes/authRoutes");
'@ | Set-Content -Encoding UTF8 ".\routes\authRoutes.js"

@'
module.exports = require("../src/routes/courseRoutes");
'@ | Set-Content -Encoding UTF8 ".\routes\courseRoutes.js"

@'
module.exports = require("../src/routes/quizRoutes");
'@ | Set-Content -Encoding UTF8 ".\routes\quizRoutes.js"

@'
module.exports = require("../src/routes/resultsRoutes");
'@ | Set-Content -Encoding UTF8 ".\routes\resultsRoutes.js"

@'
module.exports = require("../src/routes/insightsRoutes");
'@ | Set-Content -Encoding UTF8 ".\routes\insightsRoutes.js"

# ---------------------------
# 9) Seed script: real microcourse + quiz + demo users
# ---------------------------
@'
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const slugify = require("slugify");

const User = require("../src/models/User");
const Course = require("../src/models/Course");
const Lesson = require("../src/models/Lesson");
const Quiz = require("../src/models/Quiz");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri || !(uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"))) {
    throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }

  await mongoose.connect(uri);

  const instructorEmail = "instructor1@demo.local";
  const studentEmail = "student1@demo.local";

  // Users
  const upsertUser = async (email, role) => {
    const existing = await User.findOne({ email });
    if (existing) return existing;
    const passwordHash = await bcrypt.hash("Password123!", 10);
    return User.create({ email, passwordHash, role });
  };

  const instructor = await upsertUser(instructorEmail, "instructor");
  await upsertUser(studentEmail, "student");

  // Course
  const title = "MicroCourse: Using the App Like a Pro";
  const slug = slugify(title, { lower: true, strict: true });

  let course = await Course.findOne({ slug });
  if (!course) {
    course = await Course.create({
      title,
      slug,
      description: "A practical walkthrough: dashboards, quizzes, results, and next-step insights.",
      instructorEmail,
      status: "published"
    });
  }

  // Lessons
  const lessonSpecs = [
    { order: 1, title: "Welcome + Setup (5 minutes)", content: "Login, profile basics, and how to navigate the dashboard." },
    { order: 2, title: "Courses + Lessons (7 minutes)", content: "How to open a course, track lessons, and move efficiently." },
    { order: 3, title: "Quizzes (10 minutes)", content: "How to take quizzes, avoid common pitfalls, and submit confidently." },
    { order: 4, title: "Results + Insights (8 minutes)", content: "How to interpret results, charts, and improvement suggestions." }
  ];

  for (const l of lessonSpecs) {
    const exists = await Lesson.findOne({ courseId: course._id, order: l.order });
    if (!exists) await Lesson.create({ courseId: course._id, ...l });
  }

  // Quiz
  let quiz = await Quiz.findOne({ courseId: course._id, title: /Using the App Like a Pro/i });
  if (!quiz) {
    quiz = await Quiz.create({
      courseId: course._id,
      title: "Quiz: Using the App Like a Pro",
      instructions: "Answer each question. Review missed concepts after submission.",
      questions: [
        {
          prompt: "Where do you confirm the backend is alive?",
          options: ["/api/health", "/api/ping", "/status", "/api/alive"],
          correctIndex: 0,
          conceptTag: "api-health",
          explanation: "Your Express backend exposes /api/health for a quick sanity check."
        },
        {
          prompt: "Which Mongo URI scheme is valid?",
          options: ["mongo://localhost:27017/db", "mongodb://127.0.0.1:27017/db", "http://mongo:27017/db", "db://localhost"],
          correctIndex: 1,
          conceptTag: "mongodb-uri",
          explanation: "Mongoose expects mongodb:// or mongodb+srv://"
        },
        {
          prompt: "Why does Express throw 'Router.use() requires a middleware function'?",
          options: [
            "Your router has too many endpoints",
            "The required file didn't export an Express router function",
            "CORS is disabled",
            "Your port is blocked"
          ],
          correctIndex: 1,
          conceptTag: "router-export",
          explanation: "Mounting fails when the module exports an object or ESM default incorrectly."
        },
        {
          prompt: "What header format does JWT auth expect?",
          options: ["Token: <jwt>", "Authorization: JWT <jwt>", "Authorization: Bearer <jwt>", "Auth: <jwt>"],
          correctIndex: 2,
          conceptTag: "jwt-auth",
          explanation: "Your middleware parses Authorization: Bearer <token>."
        },
        {
          prompt: "What does /api/quizzes/suggested use to recommend a quiz?",
          options: ["User agent", "Last quiz missed concepts", "Random choice", "Course title length"],
          correctIndex: 1,
          conceptTag: "suggested-quiz",
          explanation: "We look at the latest QuizResult.missedConcepts to suggest a better quiz."
        },
        {
          prompt: "Where do course lessons live in this backend?",
          options: ["Course.lessons array", "Lesson model (separate collection)", "Inside QuizResult", "In .env"],
          correctIndex: 1,
          conceptTag: "data-modeling",
          explanation: "Lessons are stored in their own collection with courseId."
        },
        {
          prompt: "What does /api/results/chart return?",
          options: ["A PDF transcript", "An array of scores over time", "A list of courses", "A list of instructors"],
          correctIndex: 1,
          conceptTag: "results-chart",
          explanation: "It returns time-series points (t, score) for charting."
        },
        {
          prompt: "Best practice: where should Next.js route.ts files live?",
          options: ["In the Express backend repo", "Only in the Next.js frontend", "Inside MongoDB", "In /src/models"],
          correctIndex: 1,
          conceptTag: "repo-hygiene",
          explanation: "Next handlers in the backend repo break Express mounts."
        }
      ]
    });
  }

  console.log("✅ Seed complete:");
  console.log("Course:", course.title, String(course._id));
  console.log("Quiz:", quiz.title, String(quiz._id));
  console.log("Instructor:", instructorEmail, "Password123!");
  console.log("Student:", studentEmail, "Password123!");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e.message);
  process.exit(1);
});
'@ | Set-Content -Encoding UTF8 ".\scripts\seedDemo.js"

# ---------------------------
# 10) package.json scripts (only if missing or you want overwrite)
# ---------------------------
if (-not (Test-Path ".\package.json")) {
@'
{
  "name": "microcourse-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "seed": "node scripts/seedDemo.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.6.3",
    "slugify": "^1.6.6"
  },
  "devDependencies": {
    "nodemon": "^3.1.11"
  }
}
'@ | Set-Content -Encoding UTF8 ".\package.json"
  Write-Host "Created package.json" -ForegroundColor Green
} else {
  Write-Host "package.json exists (leaving as-is)." -ForegroundColor Yellow
}

Write-Host "`n=== DONE WRITING FILES ===" -ForegroundColor Cyan
Write-Host "Next: npm install, npm run seed, npm run dev" -ForegroundColor Cyan
