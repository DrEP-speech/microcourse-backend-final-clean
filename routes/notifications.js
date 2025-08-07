import express from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  createQuizReminder,
} from '../controllers/notificationsController.js';

const router = express.Router();

router.get('/:userId', getUserNotifications);
router.post('/:notificationId/read', markNotificationAsRead);
router.post('/reminder', createQuizReminder);

export default router;
