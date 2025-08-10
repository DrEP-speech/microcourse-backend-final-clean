import express from 'express';
import { teacherSummaryInsights, aiFeedbackForResult } from '../controllers/insightsController.js';
// import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/teacher-summary', /* requireAuth, requireRole('teacher'), */ teacherSummaryInsights);
router.get('/ai-feedback/:resultId', /* requireAuth, */ aiFeedbackForResult);

export default router;
