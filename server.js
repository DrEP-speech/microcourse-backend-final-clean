require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, status: "up" }));

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);

app.use((err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "Server error",
  });
});

const PORT = Number(process.env.PORT || 4000);

connectDB()
  .then(() => {
    console.log("DB connected");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Startup failed:", err && err.message ? err.message : err);
    process.exit(1);
  });