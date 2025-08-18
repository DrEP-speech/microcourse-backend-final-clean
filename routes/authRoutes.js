import { Router } from 'express';
import { signup, login, me, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { issueCsrf, requireCsrf } from '../middleware/requireCsrf.js';
import { signupSchema, loginSchema } from '../validators/authSchemas.js';
import { z } from 'zod';

const router = Router();
const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join(', ');
    return res.status(400).json({ success: false, message: msg });
  }
  next();
};

router.get('/csrf', issueCsrf);
router.post('/signup', validate(signupSchema), requireCsrf, signup);
router.post('/login',  validate(loginSchema),  requireCsrf, login);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);

export default router;
