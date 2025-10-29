const express = require("express");
const router = express.Router();

const validate = require("../utils/validate");
const resultSchema = require("../schemas/quizResult.schema.json");
const { Quiz, QuizResult } = require("../models");

/** GET /api/results?userId=&quizId=&page=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.quizId) filter.quizId = req.query.quizId;

    const [items, total] = await Promise.all([
      QuizResult.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
      QuizResult.countDocuments(filter),
    ]);

    res.json({ success: true, page, limit, total, items });
  } catch (err) { next(err); }
});

/** GET /api/results/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const item = await QuizResult.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: "Result not found" });
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

/** POST /api/results (raw create) */
router.post("/", validate(resultSchema), async (req, res, next) => {
  try {
    const created = await QuizResult.create(req.body);
    res.status(201).json({ success: true, item: created });
  } catch (err) { next(err); }
});

/** POST /api/results/grade (auto-grade w/ partial for multi + numeric tolerance) */
const submissionSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["quizId", "userId", "answers"],
  properties: {
    quizId: { type: "string" },
    userId: { type: "string" },
    startedAt: { type: "string", format: "date-time" },
    submittedAt: { type: "string", format: "date-time" },
    answers: {
      type: "array",
      items: {
        type: "object",
        required: ["questionId"],
        properties: {
          questionId: { type: "string" },
          selected: { type: "array", items: { type: ["string","number"] } },
          input: { type: ["string","number","null"] }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};

router.post("/grade", validate(submissionSchema), async (req, res, next) => {
  try {
    const { quizId, userId, answers, startedAt, submittedAt } = req.body;
    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found" });

    const answerMap = new Map();
    for (const a of answers) {
      answerMap.set(String(a.questionId), {
        selected: Array.isArray(a.selected) ? a.selected.map(String) : [],
        input: a.input
      });
    }

    let correctCount = 0, totalCount = quiz.questions.length;
    let scorePoints = 0, maxPoints = 0;

    const optKey = (o) =>
      o && (o.id !== undefined ? String(o.id)
        : (o._id !== undefined ? String(o._id)
        : (o.text !== undefined ? String(o.text) : "")));

    const breakdown = [];

    for (const q of quiz.questions) {
      const qId = String(q._id);
      const given = answerMap.get(qId) || { selected: [], input: undefined };
      const selected = (given.selected || []).map(String);
      const input = given.input;

      const points = typeof q.points === "number" ? q.points : 1;
      maxPoints += points;

      const correctOpts = Array.isArray(q.options)
        ? q.options.filter(o => o && o.correct).map(optKey)
        : [];

      let isCorrect = false, awarded = 0;

      switch (q.type) {
        case "single":
        case "truefalse": {
          const exp = correctOpts[0];
          isCorrect = selected.length === 1 && exp && selected[0] === exp;
          awarded = isCorrect ? points : 0;
          break;
        }
        case "multi": {
          const sel = new Set(selected);
          const cor = new Set(correctOpts);
          const tp  = [...sel].filter(v => cor.has(v)).length;
          const fp  = [...sel].filter(v => !cor.has(v)).length;
          const totalCor = cor.size;
          const partial = q.meta?.partial === "ratio";

          if (partial && totalCor > 0) {
            const fraction = Math.max(0, Math.min(1, (tp - fp) / totalCor));
            awarded = points * fraction;
            isCorrect = (tp === totalCor && fp === 0);
          } else {
            isCorrect = (tp === totalCor && fp === 0);
            awarded = isCorrect ? points : 0;
          }
          break;
        }
        case "short": {
          const expected = new Set(
            (q.options || [])
              .filter(o => o && o.correct && o.text != null)
              .map(o => String(o.text).trim().toLowerCase())
          );
          const givenTxt = (input != null ? String(input) : (selected[0] || "")).trim().toLowerCase();
          isCorrect = expected.size > 0 && expected.has(givenTxt);
          awarded = isCorrect ? points : 0;
          break;
        }
        case "numeric": {
          const tol = (q.meta && typeof q.meta.tolerance === "number") ? q.meta.tolerance : 0;
          const expOpt = (q.options || []).find(o => o && o.correct);
          const exp = expOpt ? Number(expOpt.text) : NaN;
          const got = Number(input != null ? input : selected[0]);
          isCorrect = Number.isFinite(exp) && Number.isFinite(got) && Math.abs(got - exp) <= tol;
          awarded = isCorrect ? points : 0;
          break;
        }
        default:
          isCorrect = false; awarded = 0;
      }

      if (isCorrect) correctCount += 1;
      scorePoints += awarded;
      breakdown.push({ questionId: qId, correct: isCorrect, selected, input, awarded });
    }

    const percentage = maxPoints > 0 ? (scorePoints / maxPoints) * 100 : 0;

    const doc = await QuizResult.create({
      quizId, userId,
      score: scorePoints, percentage,
      correctCount, totalCount,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
      breakdown
    });

    res.status(201).json({ success: true, item: doc });
  } catch (err) { next(err); }
});

module.exports = router;

