import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import { bulkLimiter } from '../middleware/limiters.js';
import Course from '../models/Course.js';
import Quiz from '../models/Quiz.js';
import { parsePaging, buildPageMeta, escapeRegex } from '../utils/pagination.js';
import { parseSort } from '../utils/sort.js';
import { sendCached } from '../utils/cache.js';
import { courseCreateSchema, courseUpdateSchema, courseBulkSchema } from '../validators/courseSchemas.js';

const r = Router();

// LIST
r.get('/', async (req, res) => {
  const { limit, page, skip } = parsePaging(req);
  const sort = parseSort(req.query.sort, ['createdAt','title','published'], { createdAt: -1 });

  const q = (req.query.q ?? '').toString().trim();
  const filter = { deleted: { $ne: true } };
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs, newest] = await Promise.all([
    Course.countDocuments(filter),
    Course.find(filter).select('_id title updatedAt').sort(sort).skip(skip).limit(limit).lean(),
    Course.find(filter).select('updatedAt').sort({ updatedAt: -1 }).limit(1).lean(),
  ]);

  const payload = { items: docs.map(d => ({ _id:d._id, title:d.title })), ...buildPageMeta({ total, page, limit }) };
  sendCached(req, res, payload, newest[0]?.updatedAt || docs[0]?.updatedAt);
});

// BULK
r.post('/bulk', authBearer, bulkLimiter, async (req, res) => {
  const parsed = courseBulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success:false, message: parsed.error.issues[0].message });

  const items = parsed.data.map(i => ({
    ...i,
    owner: req.user.id,
    updatedBy: req.user.id,
  }));
  const docs = await Course.insertMany(items, { ordered: true });
  res.status(201).json({ success:true, inserted: docs.map(d => d._id) });
});

// CREATE
r.post('/', authBearer, async (req, res) => {
  const parsed = courseCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success:false, message: parsed.error.issues[0].message });

  const doc = await Course.create({ ...parsed.data, owner: req.user.id, updatedBy: req.user.id });
  res.status(201).json({ success:true, _id: doc._id });
});

// NESTED QUIZZES (owner sees drafts)
r.get('/:id/quizzes', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const course = await Course.findById(id).select('_id owner deleted').lean();
  if (!course || course.deleted) return res.status(404).json({ success:false, message:'Course not found' });

  const { limit, page, skip } = parsePaging(req);
  const sort = parseSort(req.query.sort, ['createdAt','title','published'], { createdAt: -1 });
  const q = (req.query.q ?? '').toString().trim();

  let filter = { course: id, deleted: { $ne: true }, published: true };

  try {
    const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)/i);
    if (m) {
      const jwt = await import('jsonwebtoken');
      const payload = jwt.default.verify(m[1], process.env.JWT_SECRET);
      if (payload?.id && String(payload.id) === String(course.owner)) filter = { course:id, deleted: { $ne: true } };
    }
  } catch { /* public */ }

  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs, newest] = await Promise.all([
    Quiz.countDocuments(filter),
    Quiz.find(filter).select('_id title published updatedAt').sort(sort).skip(skip).limit(limit).lean(),
    Quiz.find(filter).select('updatedAt').sort({ updatedAt:-1 }).limit(1).lean(),
  ]);

  const payload = { items: docs.map(d => ({ _id:d._id, title:d.title, published:d.published })), ...buildPageMeta({ total, page, limit }) };
  sendCached(req, res, payload, newest[0]?.updatedAt || docs[0]?.updatedAt);
});

// READ
r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const doc = await Course.findById(id).select('_id title description published owner deleted updatedAt').lean();
  if (!doc || doc.deleted) return res.status(404).json({ success:false, message:'Not found' });

  sendCached(req, res, doc, doc.updatedAt);
});

// UPDATE
r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const parsed = courseUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success:false, message: parsed.error.issues[0].message });

  const doc = await Course.findById(id);
  if (!doc || doc.deleted) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

  Object.assign(doc, parsed.data, { updatedBy: req.user.id });
  await doc.save();
  res.json({ success:true });
});

// DELETE (soft) + cascade soft-delete quizzes
r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const doc = await Course.findById(id);
  if (!doc || doc.deleted) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

  doc.deleted = true; doc.deletedAt = new Date(); doc.deletedBy = req.user.id; doc.updatedBy = req.user.id;
  await doc.save();
  await Quiz.updateMany({ course: doc._id, deleted: { $ne: true } }, { $set: { deleted:true, deletedAt:new Date(), deletedBy:req.user.id, updatedBy:req.user.id } });
  res.json({ success:true });
});

export default r;
