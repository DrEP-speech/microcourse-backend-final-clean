import express from 'express';
import { listNotifications, createNotification, markRead } from '../controllers/notificationController.js';
// import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', /* requireAuth, */ listNotifications);
router.post('/', /* requireAuth, */ createNotification);
router.patch('/:id/read', /* requireAuth, */ markRead);

export default router;
