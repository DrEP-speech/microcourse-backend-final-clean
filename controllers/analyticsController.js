exports.studentOverview = async (req, res) => {
  return res.json({ ok: true, overview: { quizzesTaken: 0, avgScore: null } });
};