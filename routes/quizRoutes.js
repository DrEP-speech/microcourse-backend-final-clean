import express from 'express';
import { listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz } from '../controllers/quizController.js';
// import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listQuizzes);
router.post('/', /* requireAuth, */ createQuiz);
router.get('/:id', getQuiz);
router.patch('/:id', /* requireAuth, */ updateQuiz);
router.delete('/:id', /* requireAuth, */ deleteQuiz);

export default router;
