import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import { bulkLimiter } from '../middleware/limiters.js';
import Quiz from '../models/Quiz.js';
import Course from '../models/Course.js';
import { parsePaging, buildPageMeta, escapeRegex } from '../utils/pagination.js';
import { parseSort } from '../utils/sort.js';
import { sendCached } from '../utils/cache.js';
import { quizCreateSchema, quizUpdateSchema, quizBulkSchema } from '../validators/quizSchemas.js';

const r = Router();

// LIST
r.get('/', async (req, res) => {
  const { limit, page, skip } = parsePaging(req);
  const sort = parseSort(req.query.sort, ['createdAt','title','published'], { createdAt: -1 });

  const filter = { deleted: { $ne: true } };
  if (req.query.course && mongoose.isValidObjectId(req.query.course)) filter.course = req.query.course;
  const q = (req.query.q ?? '').toString().trim();
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs, newest] = await Promise.all([
    Quiz.countDocuments(filter),
    Quiz.find(filter).select('_id title course published updatedAt').sort(sort).skip(skip).limit(limit).lean(),
    Quiz.find(filter).select('updatedAt').sort({ updatedAt:-1 }).limit(1).lean(),
  ]);

  const payload = { items: docs, ...buildPageMeta({ total, page, limit }) };
  sendCached(req, res, payload, newest[0]?.updatedAt || docs[0]?.updatedAt);
});

// BULK
r.post('/bulk', authBearer, bulkLimiter, async (req, res) => {
  const parsed = quizBulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success:false, message: parsed.error.issues[0].message });

  const courseIds = [...new Set(parsed.data.map(i => i.course))];
  const owned = await Course.find({ _id: { $in: courseIds }, owner: req.user.id, deleted: { $ne: true } }).select('_id').lean();
  const ownedSet = new Set(owned.map(d => String(d._id)));
  if (!courseIds.every(id => ownedSet.has(String(id)))) {
    return res.status(403).json({ success:false, message:'One or more courses are not owned by you' });
  }

  const items = parsed.data.map(i => ({ ...i, owner: req.user.id, updatedBy: req.user.id }));
  const docs = await Quiz.insertMany(items, { ordered: true });
  res.status(201).json({ success:true, inserted: docs.map(d => d._id) });
});

// READ
r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const doc = await Quiz.findById(id).select('_id title description published course owner deleted updatedAt questions').lean();
  if (!doc || doc.deleted) return res.status(404).json({ success:false, message:'Not found' });

  sendCached(req, res, doc, doc.updatedAt);
});

// CREATE
r.post('/', authBearer, async (req, res) => {
  const parsed = quizCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success:false, message: parsed.error.issues[0].message });

  const owned = await Course.findOne({ _id: parsed.data.course, owner: req.user.id, deleted: { $ne: true } }).select('_id').lean();
  if (!owned) return res.status(403).json({ success:false, message:'Course not owned by you' });

  const doc = await Quiz.create({ ...parsed.data, owner: req.user.id, updatedBy: req.user.id });
  res.status(201).json({ success:true, _id: doc._id });
});

// UPDATE
r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const parsed = quizUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success:false, message: parsed.error.issues[0].message });

  const doc = await Quiz.findById(id);
  if (!doc || doc.deleted) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

  if (parsed.data.course) {
    const owned = await Course.findOne({ _id: parsed.data.course, owner: req.user.id, deleted: { $ne: true } }).select('_id').lean();
    if (!owned) return res.status(403).json({ success:false, message:'New course not owned by you' });
  }

  Object.assign(doc, parsed.data, { updatedBy: req.user.id });
  await doc.save();
  res.json({ success:true });
});

// DELETE (soft)
r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success:false, message:'Invalid id' });

  const doc = await Quiz.findById(id);
  if (!doc || doc.deleted) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

  doc.deleted = true; doc.deletedAt = new Date(); doc.deletedBy = req.user.id; doc.updatedBy = req.user.id;
  await doc.save();
  res.json({ success:true });
});

export default r;
