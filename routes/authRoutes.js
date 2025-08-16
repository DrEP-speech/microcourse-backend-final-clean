// routes/authRoutes.js
import express from 'express';
import { signup, login, me, logout } from '../controllers/authController.js';
import validate from '../middleware/validate.js';
import requireAuth from '../middleware/requireAuth.js';
import { validateSignup, validateLogin } from '../validators/authSchemas.js';

const router = express.Router();

router.post('/signup', validate(validateSignup), signup);
router.post('/login',  validate(validateLogin),  login);
router.get('/me',      requireAuth,             me);
router.post('/logout', logout);

export default router;
