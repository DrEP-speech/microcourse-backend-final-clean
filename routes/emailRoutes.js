import express from 'express';
import { sendEmail, previewEmail } from '../controllers/emailController.js';
// import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/send', /* requireAuth, requireRole('admin'), */ sendEmail);
router.post('/preview', /* requireAuth, */ previewEmail);

export default router;
