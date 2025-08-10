import express from 'express';
import { listResults, createResult, getResult } from '../controllers/quizResultController.js';
// import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', /* requireAuth, */ listResults);
router.post('/', /* requireAuth, */ createResult);
router.get('/:id', /* requireAuth, */ getResult);

export default router;
