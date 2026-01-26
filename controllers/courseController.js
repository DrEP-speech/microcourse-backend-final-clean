const Course = require("../models/Course");

async function listCourses(req, res) {
  const items = await Course.find({}).sort({ createdAt: -1 }).lean();
  return res.json({ ok: true, items });
}

async function createCourse(req, res) {
  try {
    const { title, description = "", status = "draft", slug } = req.body || {};

    if (!title) {
      return res.status(400).json({ ok: false, error: "title is required" });
    }

    const course = await Course.create({
      title,
      description,
      status,
      slug, // if missing, model pre-validate will generate from title
      createdBy: req.user?.id || null
    });

    return res.status(201).json({ ok: true, course });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", detail: err.message });
  }
}

module.exports = { listCourses, createCourse };
