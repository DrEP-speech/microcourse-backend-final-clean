import { Router } from 'express';
import { signup, login, me, refresh, logoutEverywhere } from '../controllers/authController.js';
import { issueCsrf } from '../controllers/csrfController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireCsrf } from '../middleware/requireCsrf.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema } from '../validators/authSchemas.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// CSRF token (no auth)
router.get('/csrf', asyncHandler(issueCsrf));

// signup / login need CSRF + body validation
router.post('/signup', requireCsrf, validate(signupSchema), asyncHandler(signup));
router.post('/login',  requireCsrf, validate(loginSchema),  asyncHandler(login));

// session info (cookie or bearer)
router.get('/me', requireAuth, asyncHandler(me));

// optional extras if you added them
router.post('/refresh',           requireCsrf, asyncHandler(refresh));
router.post('/logout-everywhere', requireCsrf, requireAuth, asyncHandler(logoutEverywhere));

export default router;
