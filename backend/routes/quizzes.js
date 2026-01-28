const express = require("express");
const router = express.Router();

const validate = require("../utils/validate");
const quizSchema = require("../schemas/quiz.schema.json");
const { Quiz } = require("../models");

/** GET /api/quizzes */
router.get("/", async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.q) filter.title = new RegExp(req.query.q, "i");

    const [items, total] = await Promise.all([
      Quiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Quiz.countDocuments(filter),
    ]);

    res.json({ success: true, page, limit, total, items });
  } catch (err) { next(err); }
});

/** GET /api/quizzes/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const item = await Quiz.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: "Quiz not found" });
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

/** GET /api/quizzes/:id/answer-key */
router.get("/:id/answer-key", async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).lean();
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found" });

    const keyOf = (o) =>
      o && (o.id !== undefined ? String(o.id)
        : (o._id !== undefined ? String(o._id)
        : (o.text !== undefined ? String(o.text) : "")));

    const key = (quiz.questions || []).map(q => {
      const base = { questionId: String(q._id), type: q.type, points: q.points ?? 1, meta: q.meta || {} };

      if (q.type === "short" || q.type === "numeric") {
        return {
          ...base,
          correct: (q.options || [])
            .filter(o => o && o.correct && o.text != null)
            .map(o => String(o.text))
        };
      } else {
        return {
          ...base,
          correct: (q.options || [])
            .filter(o => o && o.correct)
            .map(keyOf)
        };
      }
    });

    res.json({ success: true, quizId: String(quiz._id), key });
  } catch (err) { next(err); }
});

/** POST /api/quizzes */
router.post("/", validate(quizSchema), async (req, res, next) => {
  try {
    const created = await Quiz.create(req.body);
    res.status(201).json({ success: true, item: created });
  } catch (err) { next(err); }
});

module.exports = router;

