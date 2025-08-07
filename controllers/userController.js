// controllers/userController.js
import asyncHandler from 'express-async-handler';

// Dummy DB mock – replace with real MongoDB model later
const users = [];

// @desc    Register new user
// @route   POST /api/users/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = users.find((u) => u.email === email);
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const newUser = { id: users.length + 1, name, email, password };
  users.push(newUser);

  res.status(201).json({
    message: 'User registered',
    user: newUser,
  });
});

// @desc    Login user
// @route   POST /api/users/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  res.json({
    message: 'Login successful',
    user,
  });
});

// @desc    Get user profile
// @route   GET /api/users/profile
export const getUserProfile = asyncHandler(async (req, res) => {
  const mockUser = users[0] || null;
  if (!mockUser) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({ user: mockUser });
});
