const Course = require("../models/Course");

/**
 * Public: list courses
 * GET /api/courses
 */
async function listCourses(req, res) {
  try {
    // Optional filtering support (safe defaults)
    const { published, status, level, category, q } = req.query;

    const filter = {};

    // Handle either published=true/false OR status=published/draft
    if (published !== undefined) {
      filter.published = String(published).toLowerCase() === "true";
    }
    if (status) {
      filter.status = status;
    }
    if (level) filter.level = level;
    if (category) filter.category = category;

    if (q) {
      // basic search on title/description
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } }
      ];
    }

    const courses = await Course.find(filter).sort({ createdAt: -1 });
    return res.json({ ok: true, courses });
  } catch (err) {
    console.error("listCourses error:", err);
    return res.status(500).json({ ok: false, error: "Failed to list courses" });
  }
}

/**
 * Public: get one course by id
 * GET /api/courses/:id
 */
async function getCourseById(req, res) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
    return res.json({ ok: true, course });
  } catch (err) {
    console.error("getCourseById error:", err);
    return res.status(500).json({ ok: false, error: "Failed to get course" });
  }
}

/**
 * Admin/Instructor: create
 * POST /api/courses
 */
async function createCourse(req, res) {
  try {
    const payload = req.body || {};
    const course = await Course.create(payload);
    return res.status(201).json({ ok: true, course });
  } catch (err) {
    console.error("createCourse error:", err);
    return res.status(500).json({ ok: false, error: "Failed to create course" });
  }
}

/**
 * Admin/Instructor: update
 * PUT /api/courses/:id
 */
async function updateCourse(req, res) {
  try {
    const payload = req.body || {};
    const course = await Course.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
    return res.json({ ok: true, course });
  } catch (err) {
    console.error("updateCourse error:", err);
    return res.status(500).json({ ok: false, error: "Failed to update course" });
  }
}

/**
 * Admin/Instructor: delete
 * DELETE /api/courses/:id
 */
async function deleteCourse(req, res) {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
    return res.json({ ok: true, deletedId: course._id });
  } catch (err) {
    console.error("deleteCourse error:", err);
    return res.status(500).json({ ok: false, error: "Failed to delete course" });
  }
}

module.exports = {
  listCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
};