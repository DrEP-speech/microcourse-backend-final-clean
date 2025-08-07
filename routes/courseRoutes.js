// routes/courseRoutes.js
import express from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCoursesByInstructor
} from '../controllers/courseController.js';

import { protect, instructorOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/courses
 * @desc    Get all published courses
 * @access  Public
 */
router.get('/', getAllCourses);

/**
 * @route   GET /api/courses/:id
 * @desc    Get course by ID
 * @access  Public
 */
router.get('/:id', getCourseById);

/**
 * @route   GET /api/courses/instructor/:instructorId
 * @desc    Get all courses for a specific instructor
 * @access  Protected
 */
router.get('/instructor/:instructorId', protect, instructorOnly, getCoursesByInstructor);

/**
 * @route   POST /api/courses
 * @desc    Create a new course
 * @access  Protected (Instructor)
 */
router.post('/', protect, instructorOnly, createCourse);

/**
 * @route   PUT /api/courses/:id
 * @desc    Update a course
 * @access  Protected (Instructor)
 */
router.put('/:id', protect, instructorOnly, updateCourse);

/**
 * @route   DELETE /api/courses/:id
 * @desc    Delete a course
 * @access  Protected (Instructor)
 */
router.delete('/:id', protect, instructorOnly, deleteCourse);

export default router;
