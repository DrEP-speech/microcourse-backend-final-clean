try { require("dotenv").config(); } catch (_) {}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const { connectDB } = require("./db");

const app = express();
// ==== Hard proof the correct file is running in PROD ====
app.get("/__ping", (req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || null,
    render: {
      service: process.env.RENDER_SERVICE_NAME || null,
      commit: process.env.RENDER_GIT_COMMIT || null,
    },
  });
});
app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));
app.get("/readyz", (req, res) => res.status(200).json({ ok: true }));
app.get("/health",  (req, res) => res.status(200).send("ok")); // optional if your tooling expects it
app.get("/version", (req, res) =>
  res.status(200).json({
    name: process.env.RENDER_SERVICE_NAME || "microcourse-backend",
    commit: process.env.RENDER_GIT_COMMIT || null,
    node: process.version
  })
);
console.log("=== MICROCOURSE BACKEND BOOT ===", {
  when: new Date().toISOString(),
  node: process.version,
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  renderService: process.env.RENDER_SERVICE_NAME,
  renderCommit: process.env.RENDER_GIT_COMMIT,
});

// --- middleware ---
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- system routes (must exist even if other routes are missing) ---
const systemRoutes = require("./routes/systemRoutes");
app.use("/", systemRoutes);       // /health, /healthz, /readyz, /version
app.use("/api", systemRoutes);    // /api/health, /api/healthz, /api/readyz, /api/version

// Legacy compatibility endpoint (some clients expect /api/health)
app.get("/api", (req, res) => res.status(200).json({ ok: true }));


// --- mount helper (won't crash if optional route files are absent) ---
function safeMount(path, modulePath) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const router = require(modulePath);
    app.use(path, router);
    console.log(`[mount] ${path} -> ${modulePath}`);
  } catch (e) {
    console.log(`[mount] Skipping ${path} - missing ${modulePath}`);
  }
}

// --- core API routes (add-ons can be dropped in without touching server.js) ---
safeMount("/api/auth", "./routes/authRoutes");
safeMount("/api/users", "./routes/userRoutes");
safeMount("/api/courses", "./routes/courseRoutes");
safeMount("/api/lessons", "./routes/lessonRoutes");
safeMount("/api/quizzes", "./routes/quizRoutes");
safeMount("/api/analytics", "./routes/analyticsRoutes");

// Future add-ons (safe to include now)
safeMount("/api/insights", "./routes/insightsRoutes");
safeMount("/api/admin", "./routes/adminRoutes");
safeMount("/api/audit", "./routes/auditRoutes");
safeMount("/api/email", "./routes/emailRoutes");
safeMount("/api/notifications", "./routes/notificationRoutes");
safeMount("/api/badges", "./routes/badgeRoutes");
safeMount("/api/pdf", "./routes/pdfRoutes");
safeMount("/api/auth/google", "./routes/googleAuthRoutes");

// --- not found ---
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// --- error handler ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server Error" });
});

const PORT = Number(process.env.PORT || 4000);

(async () => {
  try {
    // DB is optional in early boot; connect if configured
    await connectDB?.();
  } catch (e) {
    console.warn("DB connect skipped/failed:", e?.message || e);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server listening on port ${PORT}`);
  });
})();