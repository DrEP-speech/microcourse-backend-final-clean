import express from 'express';
import {
  generateAIQuizFeedback,
  getStudentAnalytics,
  getQuizPerformanceSummary,
} from '../controllers/insightsController.js';

const router = express.Router();

router.post('/ai-feedback', generateAIQuizFeedback);
router.get('/student/:studentId', getStudentAnalytics);
router.get('/quiz/:quizId', getQuizPerformanceSummary);

export default router;
