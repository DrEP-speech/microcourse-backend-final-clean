const QuizResult = require("../models/QuizResult");
const { HttpError } = require("../utils/httpError");

async function studentOverview(req, res, next) {
  try {
    const userId = req.user._id;

    const recent = await QuizResult.find({ userId }).sort({ createdAt: -1 }).limit(20);
    const avg = recent.length ? Math.round((recent.reduce((a, r) => a + r.percent, 0) / recent.length) * 100) / 100 : 0;

    // Most missed concepts
    const conceptCounts = {};
    for (const r of recent) {
      for (const c of r.missedConcepts || []) {
        if (!c) continue;
        conceptCounts[c] = (conceptCounts[c] || 0) + 1;
      }
    }

    const missedTop = Object.entries(conceptCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([concept, count]) => ({ concept, count }));

    res.json({ ok: true, avgPercentLast20: avg, recent, missedTop });
  } catch (e) {
    next(e);
  }
}

async function teacherSummaryInsights(req, res, next) {
  try {
    if (!["admin", "instructor"].includes(req.user.role)) throw new HttpError(403, "Forbidden");
    const instructorId = req.user._id;

    // Instructor can filter by courseId or studentId in the future — keep it simple but extensible
    const limit = Math.min(Number(req.query.limit || 200), 1000);

    // For now: return a global recent snapshot (production: join by instructor courses)
    const recent = await QuizResult.find({}).sort({ createdAt: -1 }).limit(limit);

    const avg = recent.length ? Math.round((recent.reduce((a, r) => a + r.percent, 0) / recent.length) * 100) / 100 : 0;
    res.json({ ok: true, avgRecent: avg, count: recent.length, recent });
  } catch (e) {
    next(e);
  }
}

module.exports = { studentOverview, teacherSummaryInsights,
  studentOverview: notImplemented("studentOverview"),
  teacherSummaryInsights: notImplemented("teacherSummaryInsights"),
 };
