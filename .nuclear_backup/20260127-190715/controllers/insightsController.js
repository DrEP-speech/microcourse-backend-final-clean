const Insight = require("../models/Insight");

module.exports = {
  // GET /api/insights/latest?userEmail=...
  async latest(req, res) {
    try {
      const userEmail = (req.query.userEmail || "").toString().trim().toLowerCase();
      if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail is required" });

      const insight = await Insight.findOne({ userEmail }).sort({ createdAt: -1 }).lean();
      return res.json({ ok: true, insight: insight || null });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message || "Server error" });
    }
  }
};
