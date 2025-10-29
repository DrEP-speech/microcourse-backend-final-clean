// routes/adminRoutes.js
import { Router } from 'express';
import { authBearer } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Quiz from '../models/Quiz.js';

const r = Router();
r.use(authBearer, requireRole('admin'));

r.get('/stats', async (_req, res) => {
  const [users, courses, quizzes] = await Promise.all([
    User.estimatedDocumentCount(),
    Course.countDocuments({ deleted: { $ne: true } }),
    Quiz.countDocuments({ deleted: { $ne: true } })
  ]);
  res.json({ success:true, users, courses, quizzes });
});

r.get('/users', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit||'20',10), 50);
  const page  = Math.max(parseInt(req.query.page||'1',10), 1);
  const skip  = (page-1)*limit;
  const [total, items] = await Promise.all([
    User.estimatedDocumentCount(),
    User.find().select('_id email name role createdAt').sort({createdAt:-1}).skip(skip).limit(limit).lean()
  ]);
  res.json({ success:true, items, page, pages: Math.ceil(total/limit), total });
});

r.patch('/users/:id/role', async (req, res) => {
  const { id } = req.params; const { role } = req.body || {};
  if (!['user','admin'].includes(role)) return res.status(400).json({ success:false, message:'Bad role' });
  await User.updateOne({ _id: id }, { $set: { role } });
  res.json({ success:true });
});

export default r;
