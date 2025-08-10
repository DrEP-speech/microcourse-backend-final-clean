import express from 'express';
import { generateQuizReport } from '../controllers/pdfController.js';
// import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/quiz-report', /* requireAuth, */ generateQuizReport);

export default router;
