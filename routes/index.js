// routes/index.js
import express from 'express';

import quizRoutes from './quizRoutes.js';
import studentRoutes from './studentRoutes.js';
import instructorRoutes from './instructorRoutes.js';
import aiRoutes from './aiRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import emailRoutes from './emailRoutes.js';
import pdfRoutes from './pdfRoutes.js';
import authRoutes from './authRoutes.js';

const router = express.Router();

router.use('/quizzes', quizRoutes);
router.use('/student', studentRoutes);
router.use('/instructor', instructorRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/email', emailRoutes);
router.use('/pdf', pdfRoutes);
router.use('/auth', authRoutes);

export default router;
