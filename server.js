try { require("dotenv").config(); } catch (_) {}

const express = require("express");
const cors = require("cors");

const { connectDB } = require("./db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health first (must be before catch-all)
try {
  const healthRoutes = require("./routes/healthRoutes");
  app.use("/", healthRoutes);
  console.log("[route] mounted / -> ./routes/healthRoutes");
} catch (e) {
  console.warn("[route] skip / healthRoutes:", e.message);
}

// Safe route mounting helper (never crash server if a module is missing)
function safeMount(path, modulePath) {
  try {
    const router = require(modulePath);
    app.use(path, router);
    console.log(`[route] mounted ${path} -> ${modulePath}`);
  } catch (e) {
    console.warn(`[route] skip ${path} (${modulePath}): ${e.message}`);
  }
}

// Main API routes
safeMount("/api/auth", "./routes/authRoutes");
safeMount("/api/courses", "./routes/courseRoutes");
safeMount("/api/quizzes", "./routes/quizRoutes");
safeMount("/api/analytics", "./routes/analyticsRoutes");

// Optional (but we now stubbed them, so they should mount)
safeMount("/api/notifications", "./routes/notificationRoutes");
safeMount("/api/email", "./routes/emailRoutes");
safeMount("/api/audit", "./routes/auditRoutes");

// Friendly /api ping (prevents confusing 404 during smoke tests)
app.get("/api", (req, res) => res.status(200).json({ ok: true, name: "microcourse-backend" }));

// Catch-all last
app.use((req, res) => res.status(404).json({ ok: false, error: "API route not found" }));

const PORT = Number(process.env.PORT || 4000);

async function boot() {
  await connectDB(process.env.MONGO_URI);

  // attach readiness helper for /readyz
  const mongoose = require("mongoose");
  app.locals.dbReady = () => mongoose.connection?.readyState === 1;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[boot] API listening on http://localhost:${PORT}`);
  });
}

boot().catch((err) => {
  console.error("BOOT_FAILED:", err.message);
  process.exit(1);
});