// routes/authRoutes.js
import { Router } from 'express';
import {
  signup,
  login,
  me,
  refresh,
  logoutEverywhere,
  issueCsrf,
} from '../controllers/authController.js';

// ✅ requireAuth is a NAMED export from middleware/requireAuth.js
import { requireAuth } from '../middleware/requireAuth.js';

// If your CSRF middleware is a default export, keep this line.
// If it's a named export (`export const requireCsrf = ...`), change to:
//   import { requireCsrf } from '../middleware/requireCsrf.js';


const router = Router();

// Public: issue CSRF token + cookie
router.get('/csrf', issueCsrf);

// CSRF-protected public actions
router.post('/signup', requireCsrf, signup);
router.post('/login',  requireCsrf, login);
router.post('/refresh', requireCsrf, refresh);

// Authenticated + CSRF-protected action
router.post('/logout-everywhere', requireAuth, requireCsrf, logoutEverywhere);

// Authenticated read
router.get('/me', requireAuth, me);

export default router;
