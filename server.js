require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDB } = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");

const app = express();

let dbState = {
  ok: false,
  message: "DB not connected yet",
  lastError: null,
  since: new Date().toISOString(),
};

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// Health should ALWAYS be available (even if DB is down)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "microcourse-backend",
    uptimeSec: Math.floor(process.uptime()),
    db: dbState,
    ts: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "microcourse-backend",
    uptimeSec: Math.floor(process.uptime()),
    db: dbState,
    ts: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);

// Central error handler (keeps Render logs readable)
app.use((err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "Server error",
  });
});

const PORT = Number(process.env.PORT || 4000);

// Start listening FIRST (so health works even if DB is dead)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on 0.0.0.0:${PORT}`);
});

// Connect DB in the background, update dbState
(async () => {
  try {
    await connectDB();
    dbState = {
      ok: true,
      message: "DB connected",
      lastError: null,
      since: new Date().toISOString(),
    };
    console.log("DB connected");
  } catch (e) {
    dbState = {
      ok: false,
      message: "DB connection failed",
      lastError: e?.message || String(e),
      since: new Date().toISOString(),
    };
    console.error("DB connect failed:", e?.message || e);
    // IMPORTANT: do NOT exit; keep health endpoint up for debugging
  }
})();

