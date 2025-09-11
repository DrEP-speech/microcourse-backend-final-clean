// routes/quizRoutes.js
import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import Quiz from '../models/Quiz.js';

const r = Router();

/** LIST (public) — supports optional ?course=<id> */
r.get('/', async (req, res) => {
  const q = {};
  const { course } = req.query;
  if (course && mongoose.isValidObjectId(course)) q.course = course;

  const docs = await Quiz.find(q)
    .select('_id title course published')
    .sort({ createdAt: -1 })
    .lean();

  res.json(docs);
});

/** BULK create (auth) — keep BEFORE param routes */
r.post('/bulk', authBearer, async (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : null;
  if (!arr || arr.length === 0) {
    return res.status(400).json({ success: false, message: 'Body must be a non-empty array' });
  }
  if (arr.length > 50) {
    return res.status(400).json({ success: false, message: 'Max 50 items per bulk request' });
  }

  let items;
  try {
    items = arr.map((i, idx) => {
      const title = (i?.title ?? '').toString().trim();
      if (!title) throw new Error(`title is required at index ${idx}`);

      const course = i?.course && mongoose.isValidObjectId(i.course) ? i.course : undefined;
      const questions = Array.isArray(i?.questions) ? i.questions : [];

      // optional sanity-check for correctIndex vs choices length
      for (const [qi, q] of questions.entries()) {
        if (!q?.text) throw new Error(`questions[${qi}].text is required at index ${idx}`);
        if (!Array.isArray(q?.choices) || q.choices.length < 2) {
          throw new Error(`questions[${qi}].choices must have at least 2 items at index ${idx}`);
        }
        if (typeof q.correctIndex === 'number' && (q.correctIndex < 0 || q.correctIndex >= q.choices.length)) {
          throw new Error(`questions[${qi}].correctIndex out of range at index ${idx}`);
        }
      }

      return {
        title,
        description: typeof i?.description === 'string' ? i.description : undefined,
        course,
        published: !!i?.published,
        owner: req.user.id,
        questions,
      };
    });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'invalid bulk payload' });
  }

  try {
    const docs = await Quiz.insertMany(items, { ordered: true });
    res.status(201).json({ success: true, inserted: docs.map(d => d._id) });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'bulk insert failed' });
  }
});

/** READ one (public) */
r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }
  const doc = await Quiz.findById(id)
    .select('_id title description published course owner questions createdAt')
    .lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  res.json(doc);
});

/** CREATE (auth) */
r.post('/', authBearer, async (req, res) => {
  const { title, description, published, course, questions } = req.body ?? {};
  const t = (title ?? '').toString().trim();
  if (!t) return res.status(400).json({ success: false, message: 'title is required' });

  const payload = {
    title: t,
    description: typeof description === 'string' ? description : undefined,
    published: !!published,
    owner: req.user.id,
  };

  if (course && mongoose.isValidObjectId(course)) payload.course = course;

  if (Array.isArray(questions)) {
    for (const [qi, q] of questions.entries()) {
      if (!q?.text) return res.status(400).json({ success:false, message:`questions[${qi}].text is required` });
      if (!Array.isArray(q?.choices) || q.choices.length < 2) {
        return res.status(400).json({ success:false, message:`questions[${qi}].choices must have at least 2 items` });
      }
      if (typeof q.correctIndex === 'number' && (q.correctIndex < 0 || q.correctIndex >= q.choices.length)) {
        return res.status(400).json({ success:false, message:`questions[${qi}].correctIndex out of range` });
      }
    }
    payload.questions = questions;
  }

  const doc = await Quiz.create(payload);
  res.status(201).json({ success: true, _id: doc._id });
});

/** UPDATE (auth + owner) */
r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }
  const doc = await Quiz.findById(id);
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  if (doc.owner.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { title, description, published, course, questions } = req.body ?? {};

  if (title !== undefined) doc.title = String(title);
  if (description !== undefined) doc.description = String(description);
  if (published !== undefined) doc.published = !!published;
  if (course !== undefined) {
    if (course && !mongoose.isValidObjectId(course)) {
      return res.status(400).json({ success:false, message:'Invalid course id' });
    }
    doc.course = course || undefined;
  }
  if (questions !== undefined) {
    if (!Array.isArray(questions)) {
      return res.status(400).json({ success:false, message:'questions must be an array' });
    }
    for (const [qi, q] of questions.entries()) {
      if (!q?.text) return res.status(400).json({ success:false, message:`questions[${qi}].text is required` });
      if (!Array.isArray(q?.choices) || q.choices.length < 2) {
        return res.status(400).json({ success:false, message:`questions[${qi}].choices must have at least 2 items` });
      }
      if (typeof q.correctIndex === 'number' && (q.correctIndex < 0 || q.correctIndex >= q.choices.length)) {
        return res.status(400).json({ success:false, message:`questions[${qi}].correctIndex out of range` });
      }
    }
    doc.questions = questions;
  }

  await doc.save();
  res.json({ success: true });
});

/** DELETE (auth + owner) */
r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }
  const doc = await Quiz.findById(id);
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  if (doc.owner.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  await doc.deleteOne();
  res.json({ success: true });
});

export default r;
