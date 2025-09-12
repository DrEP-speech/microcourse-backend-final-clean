// routes/quizRoutes.js
import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import Quiz from '../models/Quiz.js';
import Course from '../models/Course.js';
import { parsePaging, buildPageMeta, escapeRegex } from '../utils/pagination.js';

const r = Router();

/** LIST (public) with pagination; optional ?course=<id> and ?q= */
r.get('/', async (req, res) => {
  const { limit, page, skip } = parsePaging(req);
  const filter = {};
  if (req.query.course && mongoose.isValidObjectId(req.query.course)) {
    filter.course = req.query.course;
  }
  const q = (req.query.q ?? '').toString().trim();
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs] = await Promise.all([
    Quiz.countDocuments(filter),
    Quiz.find(filter).select('_id title course published').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  res.json({ items: docs, ...buildPageMeta({ total, page, limit }) });
});

/** BULK create (auth) — each item must include a course owned by user */
r.post('/bulk', authBearer, async (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : null;
  if (!arr || arr.length === 0) return res.status(400).json({ success:false, message:'Body must be a non-empty array' });
  if (arr.length > 50)          return res.status(400).json({ success:false, message:'Max 50 items per bulk request' });

  const ids = [...new Set(arr.map(i => i?.course).filter(Boolean))];
  if (!ids.length || !ids.every(id => mongoose.isValidObjectId(id))) {
    return res.status(400).json({ success:false, message:'Each item must include a valid course id' });
  }

  const owned = await Course.find({ _id: { $in: ids }, owner: req.user.id }).select('_id').lean();
  const ownedSet = new Set(owned.map(d => String(d._id)));
  if (!ids.every(id => ownedSet.has(String(id)))) {
    return res.status(403).json({ success:false, message:'One or more courses are not owned by you' });
  }

  for (const [idx, i] of arr.entries()) {
    const t = (i?.title ?? '').toString().trim();
    if (!t) return res.status(400).json({ success:false, message:`title is required at index ${idx}` });
    if (Array.isArray(i?.questions)) {
      for (const [qi, q] of i.questions.entries()) {
        if (!q?.text) return res.status(400).json({ success:false, message:`questions[${qi}].text required at index ${idx}` });
        if (!Array.isArray(q?.choices) || q.choices.length < 2) {
          return res.status(400).json({ success:false, message:`questions[${qi}].choices must have ≥2 at index ${idx}` });
        }
        if (typeof q.correctIndex === 'number' && (q.correctIndex < 0 || q.correctIndex >= q.choices.length)) {
          return res.status(400).json({ success:false, message:`questions[${qi}].correctIndex out of range at index ${idx}` });
        }
      }
    }
  }

  const items = arr.map(i => ({
    title: String(i.title).trim(),
    description: typeof i?.description === 'string' ? i.description : undefined,
    course: i.course,
    published: !!i?.published,
    owner: req.user.id,
    questions: Array.isArray(i?.questions) ? i.questions : [],
  }));

  const docs = await Quiz.insertMany(items, { ordered: true });
  res.status(201).json({ success:true, inserted: docs.map(d => d._id) });
});

/** READ one (public) */
r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });
  const doc = await Quiz.findById(id).select('_id title description published course owner questions createdAt').lean();
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  res.json(doc);
});

/** CREATE (auth + course ownership) */
r.post('/', authBearer, async (req, res) => {
  const { title, description, published, course, questions } = req.body ?? {};
  const t = (title ?? '').toString().trim();
  if (!t) return res.status(400).json({ success:false, message:'title is required' });
  if (!mongoose.isValidObjectId(course)) return res.status(400).json({ success:false, message:'valid course is required' });

  const owned = await Course.findOne({ _id: course, owner: req.user.id }).select('_id').lean();
  if (!owned) return res.status(403).json({ success:false, message:'Course not owned by you' });

  if (Array.isArray(questions)) {
    for (const [qi, q] of questions.entries()) {
      if (!q?.text) return res.status(400).json({ success:false, message:`questions[${qi}].text is required` });
      if (!Array.isArray(q?.choices) || q.choices.length < 2) {
        return res.status(400).json({ success:false, message:`questions[${qi}].choices must have ≥2` });
      }
      if (typeof q.correctIndex === 'number' && (q.correctIndex < 0 || q.correctIndex >= q.choices.length)) {
        return res.status(400).json({ success:false, message:`questions[${qi}].correctIndex out of range` });
      }
    }
  }

  const doc = await Quiz.create({
    title: t,
    description: typeof description === 'string' ? description : undefined,
    published: !!published,
    owner: req.user.id,
    course,
    questions: Array.isArray(questions) ? questions : [],
  });
  res.status(201).json({ success:true, _id: doc._id });
});

/** UPDATE (auth + owner; course reassignment requires ownership too) */
r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const doc = await Quiz.findById(id);
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

  const { title, description, published, course, questions } = req.body ?? {};

  if (course !== undefined) {
    if (!course) return res.status(400).json({ success:false, message:'course is required' });
    if (!mongoose.isValidObjectId(course)) return res.status(400).json({ success:false, message:'Invalid course id' });
    const owned = await Course.findOne({ _id: course, owner: req.user.id }).select('_id').lean();
    if (!owned) return res.status(403).json({ success:false, message:'New course not owned by you' });
    doc.course = course;
  }

  if (title !== undefined) doc.title = String(title);
  if (description !== undefined) doc.description = String(description);
  if (published !== undefined) doc.published = !!published;

  if (questions !== undefined) {
    if (!Array.isArray(questions)) return res.status(400).json({ success:false, message:'questions must be an array' });
    for (const [qi, q] of questions.entries()) {
      if (!q?.text) return res.status(400).json({ success:false, message:`questions[${qi}].text is required` });
      if (!Array.isArray(q?.choices) || q.choices.length < 2) {
        return res.status(400).json({ success:false, message:`questions[${qi}].choices must have ≥2` });
      }
      if (typeof q.correctIndex === 'number' && (q.correctIndex < 0 || q.correctIndex >= q.choices.length)) {
        return res.status(400).json({ success:false, message:`questions[${qi}].correctIndex out of range` });
      }
    }
    doc.questions = questions;
  }

  await doc.save();
  res.json({ success:true });
});

/** DELETE (auth + owner) */
r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });
  const doc = await Quiz.findById(id);
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });
  await doc.deleteOne();
  res.json({ success:true });
});

export default r;
