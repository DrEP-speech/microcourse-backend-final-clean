const Insight = require("../models/Insight");

async function latest(req, res) {
  const userEmail = String(req.query.userEmail || "").toLowerCase().trim();
  if (!userEmail) return res.status(400).json({ ok: false, error: "userEmail required" });

  const insight = await Insight.findOne({ userEmail }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, insight: insight || null });
}

module.exports = { latest };
