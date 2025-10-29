require("dotenv").config();

const path = require("path");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const swaggerUI = require("swagger-ui-express");
const YAML = require("yamljs");

const connectDB = require("./backend/db");
const models = require("./backend/models");

// Routers
const healthRouter  = require("./backend/routes/health");
const seedRouter    = require("./backend/routes/seed");
const coursesRouter = require("./backend/routes/courses");
const quizzesRouter = require("./backend/routes/quizzes");
const resultsRouter = require("./backend/routes/results");

const app = express();

/* ---------- security & core middleware ---------- */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

// CORS whitelist via FRONTEND_ORIGINS (comma-separated), empty = allow all (dev)
function parseOrigins(list) {
  return String(list || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
const ALLOW_ORIGINS = parseOrigins(process.env.FRONTEND_ORIGINS);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOW_ORIGINS.length === 0 || ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* ---------- rate limits ---------- */
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const gradeLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

/* ---------- swagger docs ---------- */
const openapi = YAML.load(path.join(__dirname, "openapi.yaml"));
app.use("/api/docs", swaggerUI.serve, swaggerUI.setup(openapi, { explorer: true }));

/* ---------- mounts (order matters) ---------- */
app.use("/api", apiLimiter);              // global API limiter
app.use("/api", healthRouter);            // /api/healthz, /api/health

app.use("/api/seed",    seedRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/quizzes", quizzesRouter);

// Apply stricter limiter specifically to grading endpoint
app.use("/api/results/grade", gradeLimiter);
app.use("/api/results", resultsRouter);

/* ---------- root + 404 + error handler ---------- */
app.get("/", (req, res) => {
  res.json({ ok: true, name: "Microcourse API", uptime: process.uptime() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  // Centralized error logging
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || "Internal Server Error" });
});

/* ---------- startup with Mongo + port fallback ---------- */
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/microcourse";
const BASE_PORT = Number(process.env.PORT) || 10000;

async function start(port) {
  try {
    await connectDB(MONGO_URI);
    app.locals.models = models;

    const server = app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        const next = port + 1;
        console.warn(`⚠️  Port ${port} in use, trying ${next}...`);
        start(next);
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });
  } catch (e) {
    console.error("Startup failed:", e);
    process.exit(1);
  }
}

process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r));
process.on("uncaughtException",  (e) => { console.error("uncaughtException:", e); process.exit(1); });

start(BASE_PORT);

module.exports = app;


