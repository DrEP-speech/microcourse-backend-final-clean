import { Router } from 'express';
import { signup, login, me, logout } from '../controllers/authController.js';
import { refresh, logoutEverywhere } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireCsrf, issueCsrf } from '../middleware/requireCsrf.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema } from '../validators/authSchemas.js';

const router = Router();

router.get('/csrf', issueCsrf); // <-- clients call this first to get the token cookie & value

router.post('/signup', validate(signupSchema), requireCsrf, signup);
router.post('/login',  validate(loginSchema),  requireCsrf, login);
router.get('/me',       requireAuth, me);

router.post('/refresh', refresh);                 // NEW
router.post('/logout',  requireAuth, logout);     // existing
router.post('/logout-all', requireAuth, logoutEverywhere); // NEW

export default router;
