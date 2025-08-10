import express from 'express';
import { listCourses, getCourse, createCourse, updateCourse, deleteCourse } from '../controllers/courseController.js';
// import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listCourses);
router.post('/', /* requireAuth, */ createCourse);
router.get('/:id', getCourse);
router.patch('/:id', /* requireAuth, */ updateCourse);
router.delete('/:id', /* requireAuth, */ deleteCourse);

export default router;
