// routes/authRoutes.js
const express = require('express');
const router = express.Router();

const { signup, login, me, refresh, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');
const { validate } = require('../middleware/validate');
const { SignupBody, LoginBody } = require('../validators/authSchemas');

// POST /api/auth/signup
router.post('/signup', validate(SignupBody), signup);

// POST /api/auth/login
router.post('/login', validate(LoginBody), login);

// GET /api/auth/me
router.get('/me', requireAuth(), me);

// POST /api/auth/refresh  (uses refresh cookie; no body required)
router.post('/refresh', refresh);

// POST /api/auth/logout
router.post('/logout', logout);

module.exports = router;
