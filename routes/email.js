import express from 'express';
import {
  sendEmail,
  getEmailLogs,
  resendEmail,
} from '../controllers/emailController.js';

const router = express.Router();

router.post('/send', sendEmail);
router.get('/logs', getEmailLogs);
router.post('/resend/:emailId', resendEmail);

export default router;
