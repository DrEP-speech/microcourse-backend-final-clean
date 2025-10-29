import express from 'express';
import { issueCsrf, requireCsrf } from '../middleware/csrf.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema } from '../validations/authSchemas.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { signup, login, me } from '../controllers/authController.js';

const router = express.Router();

// ⭐ The missing route:
router.get('/csrf', issueCsrf);

router.post('/signup', validate(signupSchema), requireCsrf, signup);
router.post('/login',  validate(loginSchema),  requireCsrf, login);

router.get('/me',      requireAuth, me);
router.get('/whoami',  requireAuth, me);

// optional debug
router.post('/_debug/echo', (req, res) => res.json({ ok: true, body: req.body ?? null }));

export default router;
