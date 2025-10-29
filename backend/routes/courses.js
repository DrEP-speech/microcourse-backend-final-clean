const express = require("express");
const router = express.Router();

const validate = require("../utils/validate");
const courseSchema = require("../schemas/course.schema.json");

// Use barrel export
const { Course } = require("../models");

/**
 * GET /api/courses
 * Query params:
 *   q            - text search (title/description/tags, regex-based)
 *   instructorId - filter by instructor
 *   published    - true|false
 *   page         - default 1
 *   limit        - default 20 (max 100)
 */
router.get("/", async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const { q, instructorId } = req.query;
    const published = (typeof req.query.published !== "undefined")
      ? (req.query.published === "true" || req.query.published === true)
      : undefined;

    const filter = {};
    if (q) {
      const rx = new RegExp(q, "i");
      filter.$or = [{ title: rx }, { description: rx }, { tags: { $in: [rx] } }];
    }
    if (instructorId) filter.instructorId = instructorId;
    if (typeof published === "boolean") filter.published = published;

    const [items, total] = await Promise.all([
      Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Course.countDocuments(filter),
    ]);

    res.json({ success: true, page, limit, total, items });
  } catch (err) { next(err); }
});

/**
 * GET /api/courses/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const item = await Course.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Course not found" });
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

/**
 * POST /api/courses
 * Body validated by JSON Schema (AJV)
 * Required fields per schema: title, instructorId, published
 */
router.post("/", validate(courseSchema), async (req, res, next) => {
  try {
    const created = await Course.create(req.body);
    res.status(201).json({ success: true, item: created });
  } catch (err) { next(err); }
});

module.exports = router;
