// routes/userRoutes.js
import express from 'express';
const router = express.Router();
import {
  registerUser,
  loginUser,
  getUserProfile,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

// @route   POST /api/users
// @desc    Register a new user
router.post('/', registerUser);

// @route   POST /api/users/login
// @desc    Authenticate user & get token
router.post('/login', loginUser);

// @route   GET /api/users/profile
// @desc    Get user profile (requires auth)
router.get('/profile', protect, getUserProfile);

export default router;

