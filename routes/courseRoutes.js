import { Router } from 'express';
import Course from '../models/Course.js';
const router = Router();

router.get('/', async (_req, res) => {
  const docs = await Course.find({}).select('_id title').sort({ createdAt: -1 });
  res.json(docs);
});

export default router;
