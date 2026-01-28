// app.js
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");
const quizRoutes = require("./routes/quizRoutes");
const resultsRoutes = require("./routes/resultsRoutes");
const insightsRoutes = require("./routes/insightsRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// If your artifacts say apiBase is http://localhost:4000/api,
// then your base prefix is "/api"
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/insights", insightsRoutes);

module.exports = app;

