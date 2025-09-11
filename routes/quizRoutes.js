import { Router } from 'express';
import mongoose from 'mongoose';
import { authBearer } from '../middleware/auth.js';
import Quiz from '../models/Quiz.js';

const r = Router();

r.get('/', async (_req, res) => {
  const docs = await Quiz.find({})
    .select('_id title')
    .sort({ createdAt: -1 })
    .lean();
  res.json(docs);
});

r.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success:false, message:'Invalid id' });
  }
  const doc = await Quiz.findById(id).select('_id title description published owner createdAt').lean();
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  res.json(doc);
});

r.post('/', authBearer, async (req, res) => {
  const { title, description, published } = req.body ?? {};
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success:false, message:'title is required' });
  }
  const doc = await Quiz.create({
    title: title.trim(),
    description: typeof description === 'string' ? description : undefined,
    published: !!published,
    owner: req.user.id,
  });
  res.status(201).json({ success:true, _id: doc._id });
});

r.patch('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success:false, message:'Invalid id' });
  }
  const doc = await Quiz.findById(id);
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

r.delete('/:id', authBearer, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success:false, message:'Invalid id' });
  }
  const doc = await Quiz.findById(id);
  if (!doc) return res.status(404).json({ success:false, message:'Not found' });
  if (doc.owner.toString() !== req.user.id) {
    return res.status(403).json({ success:false, message:'Forbidden' });
  }
  await doc.deleteOne();
  res.json({ success:true });
});

export default r;
