/**
 * server.js (repo root)
 * Canonical Express bootstrap:
 * - dotenv
 * - CORS
 * - JSON body
 * - health route
 * - API routers
 * - 404 + error handler
 * - graceful shutdown
 */

require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");

const { connectDB } = require("./config/db");

// Routers (repo-root /routes)
const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");

// Optional routers (only mount if they exist)
// Uncomment once you confirm these files exist in /routes:
// const quizRoutes = require("./routes/quizRoutes");
// const resultsRoutes = require("./routes/resultsRoutes");
// const insightsRoutes = require("./routes/insightsRoutes");
// const notificationsRoutes = require("./routes/notificationRoutes"); // or notificationsRoutes
// const emailRoutes = require("./routes/emailRoutes");
// const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

// ---------- Config ----------
const PORT = Number(process.env.PORT || 4000);

const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  process.env.CLIENT_ORIGIN ||
  "http://localhost:3000";

// If you use cookies/auth sessions later, keep credentials: true.
// For plain Bearer JWT, credentials can be false — but leaving true is fine if origin is explicit.
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: process.env.JSON_LIMIT || "2mb" }));

// Tiny request log (no extra deps)
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`${ts} ${req.method} ${req.originalUrl}`);
  next();
});

// ---------- Routes ----------
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    status: "up",
    env: process.env.NODE_ENV || "development",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);

// Optional (uncomment when ready)
// app.use("/api/quizzes", quizRoutes);
// app.use("/api/results", resultsRoutes);
// app.use("/api/insights", insightsRoutes);
// app.use("/api/notifications", notificationsRoutes);
// app.use("/api/email", emailRoutes);
// app.use("/api/analytics", analyticsRoutes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    path: req.originalUrl,
  });
});

// ---------- Error Handler ----------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  const status = Number(err.statusCode || err.status || 500);
  res.status(status).json({
    ok: false,
    error: err.message || "Server Error",
  });
});

// ---------- Start ----------
let server;

async function start() {
  try {
    await connectDB();

    server = http.createServer(app);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`DB connected`);
      console.log(`API listening on http://localhost:${PORT}`);
      console.log(`CORS origin: ${CORS_ORIGIN}`);
    });

    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} already in use. Stop the other process or change PORT.`
        );
        process.exit(1);
      }
      console.error("Server error:", err);
      process.exit(1);
    });
  } catch (err) {
    console.error("Startup failed:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

start();

// ---------- Graceful Shutdown ----------
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);

  if (!server) process.exit(0);

  // Stop accepting new connections; finish existing
  server.close(async () => {
    try {
      // If your db module exports a disconnect function, call it here.
      // Example:
      // const mongoose = require("mongoose");
      // await mongoose.connection.close();
      console.log("Server closed.");
      process.exit(0);
    } catch (e) {
      console.error("Shutdown error:", e);
      process.exit(1);
    }
  });

  // Force-exit safety (10s)
  setTimeout(() => {
    console.error("Forced shutdown (timeout).");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
