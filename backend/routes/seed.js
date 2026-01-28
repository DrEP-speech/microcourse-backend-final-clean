const express = require("express");
const router = express.Router();
const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const { Course, Quiz, QuizResult } = require("../models");

const ALLOW = String(process.env.ALLOW_RESEED || "").trim() === "1";
const DEMO_USER_ID = "650000000000000000000002";

/* ---------- helpers ---------- */
async function fixCourseIndexes() {
  const idx = await Course.collection.indexes();
  for (const i of idx) {
    if (i.textIndexVersion && i.key && Object.prototype.hasOwnProperty.call(i.key, "tags")) {
      await Course.collection.dropIndex(i.name).catch(()=>{});
      console.log("Dropped bad text index on `tags`:", i.name);
    }
  }
  await Course.collection.createIndex({ title: "text", description: "text" }, { name: "CourseTextIndex" }).catch(()=>{});
  await Course.collection.createIndex({ tags: 1 }, { name: "CourseTagsIndex" }).catch(()=>{});
}

function keyOf(o) {
  if (!o) return "";
  if (o.id != null)  return String(o.id);
  if (o._id != null) return String(o._id);
  if (o.text != null) return String(o.text);
  return "";
}

/* ---------- GET /api/seed/status ---------- */
/* ?detail=1 -> include sample quiz (with answer key) and latest result breakdown */
router.get("/status", async (req, res, next) => {
  try {
    const detail = ["1","true","yes"].includes(String(req.query.detail).toLowerCase());

    const [courses, quizzes, results] = await Promise.all([
      Course.estimatedDocumentCount(),
      Quiz.estimatedDocumentCount(),
      QuizResult.estimatedDocumentCount(),
    ]);

    const [lastCourse, lastQuiz, lastResult] = await Promise.all([
      Course.findOne({}, { title: 1, updatedAt: 1 }).sort({ updatedAt: -1 }).lean(),
      Quiz.findOne({}, { title: 1, updatedAt: 1 }).sort({ updatedAt: -1 }).lean(),
      QuizResult.findOne({}, { submittedAt: 1, updatedAt: 1 }).sort({ submittedAt: -1 }).lean(),
    ]);

    const conn = mongoose.connection;
    const payload = {
      success: true,
      env: process.env.NODE_ENV || "development",
      db: { name: conn.name, host: conn.host, readyState: conn.readyState },
      counts: { courses, quizzes, results },
      latest: {
        course: lastCourse ? { _id: String(lastCourse._id), title: lastCourse.title, updatedAt: lastCourse.updatedAt } : null,
        quiz:   lastQuiz   ? { _id: String(lastQuiz._id),   title: lastQuiz.title,   updatedAt: lastQuiz.updatedAt   } : null,
        result: lastResult ? { _id: String(lastResult._id), submittedAt: lastResult.submittedAt, updatedAt: lastResult.updatedAt } : null,
      },
    };

    if (detail) {
      const sampleQuiz = await Quiz.findOne({}, { title:1, updatedAt:1, questions:1 }).sort({ updatedAt:-1 }).lean();
      if (sampleQuiz) {
        const key = (sampleQuiz.questions || []).map(q => {
          const base = { questionId: String(q._id), type: q.type, points: q.points ?? 1, meta: q.meta || {} };
          if (q.type === "short" || q.type === "numeric") {
            return { ...base,
              correct: (q.options||[]).filter(o=>o && o.correct && o.text!=null).map(o=>String(o.text))
            };
          } else {
            return { ...base,
              correct: (q.options||[]).filter(o=>o && o.correct).map(keyOf)
            };
          }
        });

        payload.sample = payload.sample || {};
        payload.sample.quiz = {
          _id: String(sampleQuiz._id),
          title: sampleQuiz.title,
          questions: (sampleQuiz.questions||[]).map(q => ({
            _id: String(q._id), prompt: q.prompt, type: q.type, points: q.points ?? 1,
            options: (q.options||[]).map(o => ({ id: keyOf(o), text: o.text, correct: !!o.correct })),
            meta: q.meta || {}
          })),
          answerKey: key
        };
      }

      const sampleResult = await QuizResult.findOne({}, {
        quizId:1, userId:1, score:1, percentage:1, correctCount:1, totalCount:1, submittedAt:1, breakdown:1
      }).sort({ submittedAt:-1 }).lean();

      if (sampleResult) {
        payload.sample = payload.sample || {};
        payload.sample.result = {
          _id: String(sampleResult._id),
          quizId: String(sampleResult.quizId),
          userId: String(sampleResult.userId),
          score: sampleResult.score,
          percentage: sampleResult.percentage,
          correctCount: sampleResult.correctCount,
          totalCount: sampleResult.totalCount,
          submittedAt: sampleResult.submittedAt,
          breakdown: (sampleResult.breakdown||[]).map(b => ({
            questionId: b.questionId, correct: !!b.correct, awarded: b.awarded ?? 0,
            selected: b.selected || [], input: (b.input ?? null)
          }))
        };
      }
    }

    res.json(payload);
  } catch (err) { next(err); }
});

/* ---------- POST /api/seed/fix-indexes ---------- */
router.post("/fix-indexes", async (req, res, next) => {
  try { await fixCourseIndexes(); res.json({ success: true, message: "Indexes repaired" }); }
  catch (err) { next(err); }
});

/* ---------- POST /api/seed/reseed (wipe + seed; gated) ---------- */
router.post("/reseed", async (req, res, next) => {
  try {
    if (!ALLOW) {
      return res.status(403).json({ success: false, message: "Reseed disabled. Set ALLOW_RESEED=1." });
    }
    await fixCourseIndexes();
    const wiped = await Promise.all([
      Course.deleteMany({ title: { $in: ["Demo Course"] } }),
      Quiz.deleteMany({ title: { $in: ["Demo Quiz"] } }),
      QuizResult.deleteMany({ userId: DEMO_USER_ID }),
    ]);

    const seedPath = path.resolve(process.cwd(), "seed.js");
    const child = spawn(process.execPath, [seedPath], {
      env: { ...process.env, WIPE: "1" }, cwd: process.cwd(), stdio: ["ignore","pipe","pipe"]
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());

    child.on("close", async code => {
      const [courses, quizzes, results] = await Promise.all([
        Course.estimatedDocumentCount(), Quiz.estimatedDocumentCount(), QuizResult.estimatedDocumentCount()
      ]);
      res.status(code===0?200:500).json({
        success: code===0, code,
        wiped: { coursesDeleted: wiped[0]?.deletedCount ?? 0, quizzesDeleted: wiped[1]?.deletedCount ?? 0, resultsDeleted: wiped[2]?.deletedCount ?? 0 },
        counts: { courses, quizzes, results },
        stdout: stdout.trim(), stderr: stderr.trim()
      });
    });
  } catch (err) { next(err); }
});

module.exports = router;
