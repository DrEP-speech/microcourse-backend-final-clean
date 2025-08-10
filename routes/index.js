import express from 'express';

import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import courseRoutes from './courseRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import quizRoutes from './quizRoutes.js';
import quizResultRoutes from './quizResultRoutes.js';
import badgeRoutes from './badgeRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import emailRoutes from './emailRoutes.js';
import pdfRoutes from './pdfRoutes.js';
import insightsRoutes from './insightsRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courses', courseRoutes);
router.use('/lessons', lessonRoutes);
router.use('/quizzes', quizRoutes);
router.use('/results', quizResultRoutes);
router.use('/badges', badgeRoutes);
router.use('/notifications', notificationRoutes);
router.use('/email', emailRoutes);
router.use('/pdf', pdfRoutes);
router.use('/insights', insightsRoutes);

export default router;
