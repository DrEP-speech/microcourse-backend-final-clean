const Course = require("../models/Course");

async function listCourses(req, res) {
  try {
    const courses = await Course.find({ published: true }).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, courses });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "listCourses failed", detail: String(err.message || err) });
  }
}

async function createCourse(req, res) {
  try {
    const { title, description } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: "title required" });
    const course = await Course.create({ title: String(title), description: description ? String(description) : "" });
    return res.json({ ok: true, course });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "createCourse failed", detail: String(err.message || err) });
  }
}

module.exports = { listCourses, createCourse,
  createCourse: notImplemented("createCourse"),
  deleteCourse: notImplemented("deleteCourse"),
  getCourseById: notImplemented("getCourseById"),
  listCourses: notImplemented("listCourses"),
  updateCourse: notImplemented("updateCourse"),
 };