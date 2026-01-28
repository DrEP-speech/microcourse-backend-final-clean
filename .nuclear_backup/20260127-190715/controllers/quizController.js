const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const Course = require("../models/Course");

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function encodeCursor(doc) {
  const payload = { createdAt: doc.createdAt.toISOString(), id: String(doc._id) };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeCursor(cursor) {
  try {
    const raw = Buffer.from(String(cursor), "base64").toString("utf8");
    const obj = JSON.parse(raw);
    if (!obj.createdAt || !obj.id) return null;
    if (!isObjectId(obj.id)) return null;
    const dt = new Date(obj.createdAt);
    if (Number.isNaN(dt.getTime())) return null;
    return { createdAt: dt, id: new mongoose.Types.ObjectId(obj.id) };
  } catch {
    return null;
  }
}

function stripAnswerKey(quizDoc) {
  const q = quizDoc.toObject ? quizDoc.toObject() : quizDoc;
  if (q.questions && Array.isArray(q.questions)) {
    q.questions = q.questions.map((qq) => {
      const copy = { ...qq };
      delete copy.answerIndex;
      delete copy.correctIndex;
      return copy;
    });
  }
  return q;
}

async function requireCourseAccess(req, courseId) {
  const course = await Course.findById(courseId);
  if (!course) return { ok: false, status: 404, error: "Course not found" };

  const role = req.user.role;
  const email = req.user.email;

  // Students can only see published courses
  if (role === "student" && course.status !== "published") {
    return { ok: false, status: 403, error: "Course not published" };
  }

  // Instructors can only access their own courses (admin can access all)
  if (role === "instructor" && String(course.createdByEmail) !== String(email)) {
    return { ok: false, status: 403, error: "Not your course" };
  }

  return { ok: true, course };
}

exports.listQuizzes = async (req, res) => {
  try {
    const { courseId, limit, cursor } = req.query;

    if (!isObjectId(courseId)) return res.status(400).json({ ok: false, error: "Invalid courseId" });

    const access = await requireCourseAccess(req, courseId);
    if (!access.ok) return res.status(access.status).json({ ok: false, error: access.error });

    const pageSize = Math.min(Math.max(parseInt(limit || "10", 10), 1), 50);
    const cur = cursor ? decodeCursor(cursor) : null;

    const filter = { courseId };

    if (cur) {
      filter.$or = [
        { createdAt: { $lt: cur.createdAt } },
        { createdAt: cur.createdAt, _id: { $lt: cur.id } },
      ];
    }

    const docs = await Quiz.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1);

    const hasMore = docs.length > pageSize;
    const page = hasMore ? docs.slice(0, pageSize) : docs;

    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

    // Students must never see the answer key
    const quizzes = req.user.role === "student"
      ? page.map(stripAnswerKey)
      : page;

    return res.json({ ok: true, quizzes, nextCursor });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const includeAnswerKey = String(req.query.includeAnswerKey || "false") === "true";

    if (!isObjectId(quizId)) return res.status(400).json({ ok: false, error: "Invalid quizId" });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    const access = await requireCourseAccess(req, quiz.courseId);
    if (!access.ok) return res.status(access.status).json({ ok: false, error: access.error });

    // Ownership check for instructors viewing answer keys
    if (includeAnswerKey) {
      if (req.user.role !== "instructor" && req.user.role !== "admin") {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      if (req.user.role === "instructor" && quiz.createdByEmail !== req.user.email) {
        return res.status(403).json({ ok: false, error: "Not your quiz" });
      }
      return res.json({ ok: true, quiz });
    }

    // default response
    if (req.user.role === "student") return res.json({ ok: true, quiz: stripAnswerKey(quiz) });
    return res.json({ ok: true, quiz });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

function normalizeQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return { ok: false, error: "Questions required" };

  const normalized = questions.map((q, idx) => {
    const options = Array.isArray(q.options) ? q.options : [];
    const answerIndex = (q.answerIndex !== undefined) ? q.answerIndex : q.correctIndex;

    return {
      prompt: String(q.prompt || "").trim(),
      options: options.map((x) => String(x)),
      answerIndex: answerIndex,
      explanation: q.explanation ? String(q.explanation) : "",
    };
  });

  // validate
  for (let i = 0; i < normalized.length; i++) {
    const q = normalized[i];
    if (!q.prompt) return { ok: false, error: `Question ${i} missing prompt` };
    if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, error: `Question ${i} options must have at least 2` };
    if (!Number.isInteger(q.answerIndex)) return { ok: false, error: `Question ${i} missing answerIndex` };
    if (q.answerIndex < 0 || q.answerIndex >= q.options.length) return { ok: false, error: `Question ${i} answerIndex out of range` };
  }

  return { ok: true, normalized };
}

exports.createQuiz = async (req, res) => {
  try {
    const { courseId, title, instructions, questions } = req.body;

    if (!isObjectId(courseId)) return res.status(400).json({ ok: false, error: "Invalid courseId" });

    // Course ownership enforcement: instructor can only create quizzes for their own courses
    const access = await requireCourseAccess(req, courseId);
    if (!access.ok) return res.status(access.status).json({ ok: false, error: access.error });

    const t = String(title || "").trim();
    if (!t) return res.status(400).json({ ok: false, error: "Title required" });

    const nq = normalizeQuestions(questions);
    if (!nq.ok) return res.status(400).json({ ok: false, error: nq.error });

    const quiz = await Quiz.create({
      courseId,
      title: t,
      instructions: instructions ? String(instructions) : "",
      questions: nq.normalized,
      createdByEmail: req.user.email,
    });

    return res.status(201).json({ ok: true, quiz });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!isObjectId(quizId)) return res.status(400).json({ ok: false, error: "Invalid quizId" });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    // ownership: instructors only for their own quizzes
    if (req.user.role === "instructor" && quiz.createdByEmail !== req.user.email) {
      return res.status(403).json({ ok: false, error: "Not your quiz" });
    }

    const { title, instructions, questions } = req.body;

    if (title !== undefined) quiz.title = String(title).trim();
    if (instructions !== undefined) quiz.instructions = String(instructions);

    if (questions !== undefined) {
      const nq = normalizeQuestions(questions);
      if (!nq.ok) return res.status(400).json({ ok: false, error: nq.error });
      quiz.questions = nq.normalized;
    }

    await quiz.save();
    return res.json({ ok: true, quiz });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!isObjectId(quizId)) return res.status(400).json({ ok: false, error: "Invalid quizId" });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ ok: false, error: "Quiz not found" });

    if (req.user.role === "instructor" && quiz.createdByEmail !== req.user.email) {
      return res.status(403).json({ ok: false, error: "Not your quiz" });
    }

    await Quiz.deleteOne({ _id: quizId });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
