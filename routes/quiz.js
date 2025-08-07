import express from 'express';
import {
  getAllQuizzes,
  getQuizById,
  submitQuiz,
  getStudentQuizResults,
} from '../controllers/quizController.js';

const router = express.Router();

router.get('/', getAllQuizzes);
router.get('/:quizId', getQuizById);
router.post('/submit', submitQuiz);
router.get('/results/student/:studentId', getStudentQuizResults);

export default router;
