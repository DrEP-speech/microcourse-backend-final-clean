const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Quiz = require("../models/Quiz");

async function listCourses(req, res) {
  const courses = await Course.find({ published: true })
    .select("_id title slug description published createdAt")
    .sort({ createdAt: -1 });

  return res.status(200).json({ ok: true, courses });
}

async function getCourseDetail(req, res) {
  const { courseId } = req.params;

  const course = await Course.findOne({ _id: courseId, published: true })
    .select("_id title slug description published createdAt");

  if (!course) return res.status(404).json({ ok: false, message: "Course not found" });

  const lessons = await Lesson.find({ courseId: course._id })
    .select("_id title order courseId createdAt")
    .sort({ order: 1, createdAt: 1 });

  const quizCounts = await Quiz.aggregate([
    { $match: { courseId: course._id, published: true } },
    { $group: { _id: "$lessonId", count: { $sum: 1 } } }
  ]);

  const countsMap = new Map(quizCounts.map(x => [String(x._id), x.count]));

  const lessonsWithCounts = lessons.map(l => ({
    id: l._id,
    title: l.title,
    order: l.order,
    quizCount: countsMap.get(String(l._id)) || 0,
  }));

  const courseQuizCount = await Quiz.countDocuments({ courseId: course._id, published: true });

  return res.status(200).json({
    ok: true,
    course: {
      id: course._id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      quizCount: courseQuizCount,
      lessons: lessonsWithCounts,
    },
  });
}

async function listCourseQuizzes(req, res) {
  const { courseId } = req.params;
  const { lessonId } = req.query;

  const course = await Course.findOne({ _id: courseId, published: true }).select("_id");
  if (!course) return res.status(404).json({ ok: false, message: "Course not found" });

  const filter = { courseId: course._id, published: true };
  if (lessonId) filter.lessonId = lessonId;

  const quizzes = await Quiz.find(filter)
    .select("_id title courseId lessonId createdAt")
    .sort({ createdAt: 1 });

  return res.status(200).json({ ok: true, quizzes });
}

module.exports = { listCourses, getCourseDetail, listCourseQuizzes };