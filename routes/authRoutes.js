// routes/authRoutes.js
import express from 'express';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema } from '../validators/authSchemas.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { issueCsrf, requireCsrf } from '../middleware/requireCsrf.js';

import {
  signup,
  login,
  me,
  refresh,
  logoutEverywhere,
} from '../controllers/authController.js';

const router = express.Router();

// Issue CSRF token + cookie
router.get('/csrf', issueCsrf);

// Public (but CSRF-protected) routes
router.post('/signup', validate(signupSchema), requireCsrf, signup);
router.post('/login',  validate(loginSchema),  requireCsrf, login);

// Authenticated read
router.get('/me', requireAuth, me);

// NEW: refresh & global logout
router.post('/refresh',           requireCsrf, refresh);
router.post('/logout-everywhere', requireAuth, requireCsrf, logoutEverywhere);

export default router;
