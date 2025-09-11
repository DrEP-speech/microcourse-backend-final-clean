import { Router } from 'express';
import Quiz from '../models/Quiz.js';
const router = Router();

router.get('/', async (_req, res) => {
  const docs = await Quiz.find({}).select('_id title').sort({ createdAt: -1 });
  res.json(docs);
});

export default router;
