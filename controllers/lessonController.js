const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const Course = require("../models/Course");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * GET /api/lessons/ping
 */
async function ping(req, res) {
  return res.json({ ok: true, route: "lessons" });
}

/**
 * GET /api/lessons?courseId=...
 * Public list (optionally filter by courseId)
 */
async function listLessons(req, res) {
  try {
    const { courseId } = req.query;

    const filter = {};
    if (courseId) {
      if (!isValidObjectId(courseId)) return res.status(400).json({ ok: false, error: "BAD_COURSE_ID" });
      filter.courseId = courseId;
    }

    const lessons = await Lesson.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    return res.json({ ok: true, lessons });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * GET /api/lessons/:id
 */
async function getLessonById(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });

    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.json({ ok: true, lesson });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * POST /api/lessons
 * Body: { courseId, title, content, order, isPublished }
 * Protected
 */
async function createLesson(req, res) {
  try {
    const payload = req.body || {};
    const courseId = payload.courseId;

    if (!courseId || !isValidObjectId(courseId)) {
      return res.status(400).json({ ok: false, error: "COURSE_ID_REQUIRED" });
    }

    const courseExists = await Course.exists({ _id: courseId });
    if (!courseExists) return res.status(404).json({ ok: false, error: "COURSE_NOT_FOUND" });

    const title = payload.title !== undefined ? String(payload.title).trim() : "";
    if (!title) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });

    const order = payload.order !== undefined ? Number(payload.order) : 1;
    if (!Number.isFinite(order)) return res.status(400).json({ ok: false, error: "BAD_ORDER" });

    const lesson = await Lesson.create({
      courseId,
      title,
      content: payload.content !== undefined ? payload.content : "",
      order,
      isPublished: payload.isPublished !== undefined ? Boolean(payload.isPublished) : false,
    });

    return res.status(201).json({ ok: true, lesson });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * PUT /api/lessons/:id
 * Body: { title?, content?, order?, isPublished? }
 * Protected
 */
async function updateLesson(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });

    const payload = req.body || {};
    const update = {};

    if (payload.title !== undefined) update.title = String(payload.title).trim();
    if (payload.content !== undefined) update.content = payload.content;
    if (payload.order !== undefined) update.order = Number(payload.order);
    if (payload.isPublished !== undefined) update.isPublished = Boolean(payload.isPublished);

    const lesson = await Lesson.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!lesson) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.json({ ok: true, lesson });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

/**
 * DELETE /api/lessons/:id
 * Protected
 */
async function deleteLesson(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });

    const lesson = await Lesson.findByIdAndDelete(id).lean();
    if (!lesson) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.json({ ok: true, deleted: true, lessonId: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR", details: err.message });
  }
}

module.exports = {
  ping,
  listLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
};