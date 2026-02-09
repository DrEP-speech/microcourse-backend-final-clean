exports.list = async (req, res) => {
  return res.json({ ok: true, quizzes: [] });
};