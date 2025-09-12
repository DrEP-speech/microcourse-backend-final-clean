// routes/courseRoutes.js
import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import { bulkLimiter } from '../middleware/limiters.js';
import Course from '../models/Course.js';
import Quiz from '../models/Quiz.js';
import { parsePaging, buildPageMeta, escapeRegex } from '../utils/pagination.js';
import { parseSort } from '../utils/sort.js';

const r = Router();

/**
 * GET /api/courses
 * Public list with pagination + search (?q=) + sorting (?sort=createdAt:desc,title:asc)
 */
r.get('/', async (req, res) => {
  const { limit, page, skip } = parsePaging(req);
  const sort = parseSort(req.query.sort, ['createdAt', 'title', 'published'], { createdAt: -1 });

  const q = (req.query.q ?? '').toString().trim();
  const filter = {};
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs] = await Promise.all([
    Course.countDocuments(filter),
    Course.find(filter)
      .select('_id title')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.json({ items: docs, ...buildPageMeta({ total, page, limit }) });
});

/**
 * POST /api/courses/bulk
 * Auth; per-route rate limit; create up to 50 courses in one go.
 */
r.post('/bulk', authBearer, bulkLimiter, async (req, res) => {
  const input = Array.isArray(req.body) ? req.body : null;
  if (!input || input.length === 0) {
    return res.status(400).json({ success: false, message: 'Body must be a non-empty array' });
  }
  if (input.length > 50) {
    return res.status(400).json({ success: false, message: 'Max 50 items per bulk request' });
  }

  let items;
  try {
    items = input.map((i, idx) => {
      const title = (i?.title ?? '').toString().trim();
      if (!title) throw new Error(`title is required at index ${idx}`);
      return {
        title,
        description: typeof i?.description === 'string' ? i.description : undefined,
        published: !!i?.published,
        owner: req.user.id,
      };
    });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'invalid bulk payload' });
  }

  try {
    const docs = await Course.insertMany(items, { ordered: true });
    res.status(201).json({ success: true, inserted: docs.map(d => d._id) });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'bulk insert failed' });
  }
});

/**
 * POST /api/courses
 * Auth; create one course.
 */
r.post('/', authBearer, async (req, res) => {
  const { title, description, published } = req.body ?? {};
  const t = (title ?? '').toString().trim();
  if (!t) return res.status(400).json({ success: false, message: 'title is required' });

  const doc = await Course.create({
    title: t,
    description: typeof description === 'string' ? description : undefined,
    published: !!published,
    owner: req.user.id,
  });

  res.status(201).json({ success: true, _id: doc._id });
});

/**
 * GET /api/courses/:id/quizzes
 * Public nested list; owner (Bearer) can see drafts too.
 * Supports pagination/search/sort.
 * NOTE: keep this BEFORE r.get('/:id')
 */
r.get('/:id/quizzes', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const course = await Course.findById(id).select('_id owner').lean();
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const { limit, page, skip } = parsePaging(req);
  const sort = parseSort(req.query.sort, ['createdAt', 'title', 'published'], { createdAt: -1 });
  const q = (req.query.q ?? '').toString().trim();

  // public: only published; owner (Bearer): all
  let filter = { course: id, published: true };

  try {
    const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)/i);
    if (m) {
      const jwt = await import('jsonwebtoken');
      const payload = jwt.default.verify(m[1], process.env.JWT_SECRET);
      if (payload?.id && String(payload.id) === String(course.owner)) {
        filter = { course: id };
      }
    }
  } catch {
    /* ignore, stay public filter */
  }

  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [total, docs] = await Promise.all([
    Quiz.countDocuments(filter),
    Quiz.find(filter)
      .select('_id title published createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.json({ items: docs, ...buildPageMeta({ total, page, limit }) });
});

/**
 * GET /api/courses/:id
 * Public read.
 */
r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }
  const doc = await Course.findById(id)
    .select('_id title description published owner createdAt')
    .lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  res.json(doc);
});

/**
 * PATCH /api/courses/:id
 * Auth + owner; update fields.
 */
r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  if (doc.owner.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { title, description, published } = req.body ?? {};
  if (title !== undefined) doc.title = String(title);
  if (description !== undefined) doc.description = String(description);
  if (published !== undefined) doc.published = !!published;

  await doc.save();
  res.json({ success: true });
});

/**
 * DELETE /api/courses/:id
 * Auth + owner; cascade delete quizzes in this course.
 */
r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  if (doc.owner.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  await Quiz.deleteMany({ course: doc._id });
  await doc.deleteOne();

  res.json({ success: true });
});

export default r;

