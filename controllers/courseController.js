// controllers/courseController.js
import Course from '../models/Course.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get all published courses
 * @route   GET /api/courses
 * @access  Public
 */
export const getAllCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ isPublished: true }).sort({ createdAt: -1 });
  res.json(courses);
});

/**
 * @desc    Get single course by ID
 * @route   GET /api/courses/:id
 * @access  Public
 */
export const getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  res.json(course);
});

/**
 * @desc    Get all courses for a specific instructor
 * @route   GET /api/courses/instructor/:instructorId
 * @access  Protected
 */
export const getCoursesByInstructor = asyncHandler(async (req, res) => {
  const instructorId = req.params.instructorId;

  if (req.user.role !== 'instructor' || req.user._id.toString() !== instructorId) {
    res.status(401);
    throw new Error('Not authorized to access these courses');
  }

  const courses = await Course.find({ instructor: instructorId }).sort({ updatedAt: -1 });
  res.json(courses);
});

/**
 * @desc    Create a new course
 * @route   POST /api/courses
 * @access  Protected (Instructor)
 */
export const createCourse = asyncHandler(async (req, res) => {
  const { title, description, category, image } = req.body;

  const course = new Course({
    title,
    description,
    category,
    image,
    instructor: req.user._id,
    isPublished: false
  });

  const createdCourse = await course.save();
  res.status(201).json(createdCourse);
});

/**
 * @desc    Update a course
 * @route   PUT /api/courses/:id
 * @access  Protected (Instructor)
 */
export const updateCourse = asyncHandler(async (req, res) => {
  const { title, description, category, image, isPublished } = req.body;

  const course = await Course.findById(req.params.id);

  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  if (course.instructor.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to update this course');
  }

  course.title = title || course.title;
  course.description = description || course.description;
  course.category = category || course.category;
  course.image = image || course.image;
  course.isPublished = isPublished ?? course.isPublished;

  const updated = await course.save();
  res.json(updated);
});

/**
 * @desc    Delete a course
 * @route   DELETE /api/courses/:id
 * @access  Protected (Instructor)
 */
export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  if (course.instructor.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this course');
  }

  await course.remove();
  res.json({ message: 'Course removed successfully' });
});
