import { Router } from 'express';
import { signup, login, me, refresh, logoutEverywhere, issueCsrf } from '../controllers/authController.js';
import { signupSchema, loginSchema } from '../validators/authSchemas.js';
import validate from '../middleware/validate.js';
import requireAuth from '../middleware/requireAuth.js';
import requireCsrf from '../middleware/requireCsrf.js';

const router = Router();

// CSRF bootstrap
router.get('/csrf', issueCsrf);

// Auth
router.post('/signup', validate(signupSchema), requireCsrf, signup);
router.post('/login',  validate(loginSchema),  requireCsrf, login);
router.get('/me', requireAuth, me);

// Session lifecycle
router.post('/refresh', requireCsrf, refresh);
router.post('/logout-everywhere', requireAuth, requireCsrf, logoutEverywhere);

export default router;
