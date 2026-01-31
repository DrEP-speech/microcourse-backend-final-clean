const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");

async function myProgress(req, res) {
  const userId = req.user.sub;
  const { courseId } = req.query;

  const resultFilter = { userId };

  if (courseId) {
    const quizIds = await Quiz.find({ courseId, published: true }).distinct("_id");
    resultFilter.quizId = { $in: quizIds };
  }

  const latestResults = await QuizResult.find(resultFilter)
    .sort({ createdAt: -1 })
    .limit(20)
    .select("_id quizId score maxScore percent createdAt");

  const attempts = await QuizResult.countDocuments(resultFilter);

  const avgPercentLast20 =
    latestResults.length
      ? Math.round((latestResults.reduce((a, r) => a + (r.percent || 0), 0) / latestResults.length) * 100) / 100
      : 0;

  return res.status(200).json({
    ok: true,
    progress: {
      attempts,
      avgPercentLast20,
      latestResults,
    },
  });
}

module.exports = { myProgress };