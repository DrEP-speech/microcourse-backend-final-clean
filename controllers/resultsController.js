const QuizResult = require("../models/QuizResult");

module.exports = {
  // GET /api/results?userEmail=...
  async list(req, res) {
    try {
      const userEmail = (req.query.userEmail || "").toString().trim().toLowerCase();
      if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail is required" });

      const results = await QuizResult.find({ userEmail }).sort({ createdAt: -1 }).lean();
      return res.json({ ok: true, results });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message || "Server error" });
    }
  },

  // GET /api/results/chart?userEmail=...&days=30
  async chart(req, res) {
    try {
      const userEmail = (req.query.userEmail || "").toString().trim().toLowerCase();
      const days = Math.max(1, parseInt(req.query.days || "30", 10));
      if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail is required" });

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await QuizResult.find({
        userEmail,
        createdAt: { $gte: since }
      }).sort({ createdAt: 1 }).lean();

      const series = rows.map(r => ({
        t: r.createdAt,
        score: r.score ?? 0,
        weightedScore: r.weightedScore ?? r.score ?? 0,
        quizId: r.quizId,
        courseId: r.courseId
      }));

      return res.json({ ok: true, days, series });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message || "Server error" });
    }
  }
};
