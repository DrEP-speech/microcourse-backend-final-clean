import express from 'express';
import { listLessons, getLesson, createLesson, updateLesson, deleteLesson } from '../controllers/lessonController.js';
// import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listLessons);
router.post('/', /* requireAuth, */ createLesson);
router.get('/:id', getLesson);
router.patch('/:id', /* requireAuth, */ updateLesson);
router.delete('/:id', /* requireAuth, */ deleteLesson);

export default router;
