const Course = require("../models/Course");

async function listCourses(req, res) {
  const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, courses });
}

async function createCourse(req, res) {
  const { title, description = "", level = "beginner", published = true } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: "title required" });

  const course = await Course.create({
    title,
    description,
    level,
    published: !!published,
    instructorId: req.user.id, // IMPORTANT: fixes "instructorId required"
  });

  res.json({ ok: true, course });
}

module.exports = { listCourses, createCourse };
