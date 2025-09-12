
// routes/courseRoutes.js
import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import Course from '../models/Course.js';
import Quiz from '../models/Quiz.js';
import { parsePaging, buildPageMeta, escapeRegex } from '../utils/pagination.js';

const r = Router();

/** LIST (public) with pagination + search (?q=) */
r.get('/', async (req, res) => {
  const { limit, page, skip } = parsePaging(req);
  const q = (req.query.q ?? '').toString().trim();
  const filter = {};
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs] = await Promise.all([
    Course.countDocuments(filter),
    Course.find(filter).select('_id title').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  res.json({ items: docs, ...buildPageMeta({ total, page, limit }) });
});

/** BULK create (auth) — keep BEFORE param routes */
r.post('/bulk', authBearer, async (req, res) => {
  const input = Array.isArray(req.body) ? req.body : null;
  if (!input || input.length === 0) return res.status(400).json({ success:false, message:'Body must be a non-empty array' });
  if (input.length > 50)            return res.status(400).json({ success:false, message:'Max 50 items per bulk request' });

  const items = input.map((i, idx) => {
    const title = (i?.title ?? '').toString().trim();
    if (!title) throw new Error(`title is required at index ${idx}`);
    return {
      title,
      description: typeof i?.description === 'string' ? i.description : undefined,
      published: !!i?.published,
      owner: req.user.id,
    };
  });

  const docs = await Course.insertMany(items, { ordered: true });
  res.status(201).json({ success:true, inserted: docs.map(d => d._id) });
});

/** CREATE (auth) */
r.post('/', authBearer, async (req, res) => {
  const { title, description, published } = req.body ?? {};
  const t = (title ?? '').toString().trim();
  if (!t) return res.status(400).json({ success:false, message:'title is required' });

  const doc = await Course.create({
    title: t,
    description: typeof description === 'string' ? description : undefined,
    published: !!published,
    owner: req.user.id,
  });
  res.status(201).json({ success:true, _id: doc._id });
});

/** NESTED list quizzes for a course (public: published only; owner sees all) + pagination & search (?q=) */
r.get('/:id/quizzes', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const course = await Course.findById(id).select('_id owner').lean();
  if (!course) return res.status(404).json({ success:false, message:'Course not found' });

  const { limit, page, skip } = parsePaging(req);
  const q = (req.query.q ?? '').toString().trim();

  let filter = { course: id, published: true };
  try {
    const auth = (req.headers.authorization || '').match(/^Bearer\s+(.+)/i);
    if (auth) {
      const jwt = await import('jsonwebtoken');
      const payload = jwt.default.verify(auth[1], process.env.JWT_SECRET);
      if (payload?.id && String(payload.id) === String(course.owner)) {
        filter = { course: id };
      }
    }
  } catch { /* ignore */ }

  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs] = await Promise.all([
    Quiz.countDocuments(filter),
    Quiz.find(filter).select('_id title published createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  res.json({ items: docs, ...buildPageMeta({ total, page, limit }) });
});

/** READ one (public) */
r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });
  const doc = await Course.findById(id).select('_id title description published owner createdAt').lean();
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  res.json(doc);
});

/** UPDATE (auth + owner) */
r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });
  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

  const { title, description, published } = req.body ?? {};
  if (title !== undefined) doc.title = String(title);
  if (description !== undefined) doc.description = String(description);
  if (published !== undefined) doc.published = !!published;
  await doc.save();
  res.json({ success:true });
});

/** DELETE (auth + owner) — CASCADE quizzes */
r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });
  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

  await Quiz.deleteMany({ course: doc._id });
  await doc.deleteOne();
  res.json({ success:true });
});

export default r;
