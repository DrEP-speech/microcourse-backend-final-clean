import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import Course from '../models/Course.js';

const r = Router();

// LIST (return an array to match what you already see)
r.get('/', async (_req, res) => {
  const docs = await Course.find({})
    .select('_id title')            // keep it simple for now
    .sort({ createdAt: -1 })
    .lean();
  res.json(docs);
});

// READ one
r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success:false, message:'Invalid id' });
  }
  const doc = await Course.findById(id).select('_id title description published owner createdAt').lean();
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  res.json(doc);
});

// CREATE (auth required)
r.post('/', authBearer, async (req, res) => {
  const { title, description, published } = req.body ?? {};
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success:false, message:'title is required' });
  }
  const doc = await Course.create({
    title: title.trim(),
    description: typeof description === 'string' ? description : undefined,
    published: !!published,
    owner: req.user.id,
  });
  res.status(201).json({ success:true, _id: doc._id });
});

// UPDATE (auth + owner)
r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success:false, message:'Invalid id' });
  }
  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) {
    return res.status(403).json({ success:false, message:'Forbidden' });
  }
  const { title, description, published } = req.body ?? {};
  if (title !== undefined) doc.title = String(title);
  if (description !== undefined) doc.description = String(description);
  if (published !== undefined) doc.published = !!published;
  await doc.save();
  res.json({ success:true });
});

// DELETE (auth + owner)
r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success:false, message:'Invalid id' });
  }
  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) {
    return res.status(403).json({ success:false, message:'Forbidden' });
  }
  await doc.deleteOne();
  res.json({ success:true });
});

export default r;
