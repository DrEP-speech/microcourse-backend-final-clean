require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { connectDB } = require("./config/db");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const quizRoutes = require("./routes/quizzes");
const progressRoutes = require("./routes/progress");
const courseRoutes = require("./routes/courses");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({ ok: true, message: "MicroCourse API is running" });
});

// Mount routes AFTER app is created
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/dashboard", require("./routes/dashboard"));

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    const uriPreview = (process.env.MONGO_URI || "").replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
    console.log("[debug] MONGO_URI =", uriPreview || "(missing)");

    await connectDB();

    app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  } catch (err) {
    console.error("[server] failed to start:", err.message);
    process.exit(1);
  }
}

start();

module.exports = app;