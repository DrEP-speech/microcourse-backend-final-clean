const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => res.json({ ok: true, service: "microcourse-backend", time: new Date().toISOString() }));

// Keep your existing auth routes if present
try { router.use("/auth", require("./authRoutes")); } catch (e) {}

router.use("/courses", require("./courseRoutes"));
router.use("/quizzes", require("./quizRoutes"));
router.use("/results", require("./resultsRoutes"));
router.use("/insights", require("./insightsRoutes"));

router.use('/result', require('./resultRoutes'));
module.exports = router;

