$dst = ".\controllers\courseController.js"
$code = @'
const mongoose = require("mongoose");

const Course = require("../models/Course");
const Lesson = require("../models/Lesson");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return undefined;
}

/**
 * GET /api/courses
 * Public: list courses (optional filters: ?published=true|false, ?active=true|false)
 */
async function listCourses(req, res) {
  try {
    const published = toBool(req.query.published);
    const active = toBool(req.query.active);

    const filter = {};
    if (published !== undefined) filter.isPublished = published;
    if (active !== undefined) filter.isActive = active;

    const courses = await Course.find(filter).sort({ createdAt: -1 }).select("-__v");
    return res.json({ ok: true, courses });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * GET /api/courses/:id
 * Public: get course by id
 */
async function getCourseById(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });

    const course = await Course.findById(id).select("-__v");
    if (!course) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.json({ ok: true, course });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * GET /api/courses/:id/lessons
 * Public: list lessons in a course
 * Assumes Lesson has { courseId } referencing Course._id
 */
async function listCourseLessons(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });

    const exists = await Course.exists({ _id: id });
    if (!exists) return res.status(404).json({ ok: false, error: "COURSE_NOT_FOUND" });

    const lessons = await Lesson.find({ courseId: id })
      .sort({ order: 1, createdAt: 1 })
      .select("-__v");

    return res.json({ ok: true, courseId: id, lessons });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * GET /api/courses/mine/list
 * Protected: list current user's courses
 * Requires auth middleware to populate req.user.id
 * NOTE: adjust ownerId if your Course schema uses a different field name
 */
async function listMyCourses(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const courses = await Course.find({ ownerId: userId }).sort({ createdAt: -1 }).select("-__v");
    return res.json({ ok: true, courses });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * Backward-compatible alias (your existing code exports myCourses)
 */
const myCourses = listMyCourses;

/**
 * POST /api/courses
 * Protected: create course
 */
async function createCourse(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const payload = req.body || {};
    const title = payload.title !== undefined ? String(payload.title).trim() : "";
    if (!title) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });

    const course = await Course.create({
      title,
      description: payload.description ? String(payload.description) : "",
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
      isPublished: payload.isPublished !== undefined ? Boolean(payload.isPublished) : false,
      ownerId: userId, // adjust if needed
    });

    return res.status(201).json({ ok: true, course });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * PUT /api/courses/:id
 * Protected: update course
 */
async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });

    const payload = req.body || {};
    const update = {};

    if (payload.title !== undefined) update.title = String(payload.title).trim();
    if (payload.description !== undefined) update.description = payload.description;
    if (payload.isActive !== undefined) update.isActive = payload.isActive;
    if (payload.isPublished !== undefined) update.isPublished = payload.isPublished;

    const course = await Course.findByIdAndUpdate(id, { $set: update }, { new: true }).select("-__v");
    if (!course) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.json({ ok: true, course });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * DELETE /api/courses/:id
 * Protected: delete course
 */
async function deleteCourse(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });

    const course = await Course.findByIdAndDelete(id).select("-__v");
    if (!course) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.json({ ok: true, deleted: true, courseId: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

module.exports = {
  // Existing exports (keep stable)
  listCourses,
  myCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,

  // New exports (routes expect these)
  listCourseLessons,
  listMyCourses,
};
'@
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($dst, $code, $utf8NoBom)
Write-Host "Wrote $dst"
