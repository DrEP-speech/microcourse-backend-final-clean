// routes/authRoutes.js
import { Router } from 'express';
import { signup, login, me, logout } from '../controllers/authController.js';
import { signupSchema, loginSchema } from '../validators/authSchemas.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
// If you’re using CSRF:
import { issueCsrf, requireCsrf } from '../middleware/requireCsrf.js';

const router = Router();

// CSRF token issue endpoint (public)
router.get('/csrf', issueCsrf);

// Auth
router.post('/signup', requireCsrf, validate(signupSchema), signup);
router.post('/login',  requireCsrf, validate(loginSchema),  login);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);

export default router;
