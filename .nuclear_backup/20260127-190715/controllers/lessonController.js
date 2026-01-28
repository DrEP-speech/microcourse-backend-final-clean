const Lesson = require("../models/Lesson");

async function listLessonsByCourse(req, res) {
  const { courseId } = req.params;
  const lessons = await Lesson.find({ courseId }).sort({ order: 1 }).lean();
  res.json({ ok: true, lessons });
}

module.exports = { listLessonsByCourse };
