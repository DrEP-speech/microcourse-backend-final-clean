// routes/notificationRoutes.js
import express from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { list, create, markRead, remove } from '../controllers/notificationController.js';

const router = express.Router();

// protect as needed
router.get('/', requireAuth, list);
router.post('/', requireAuth, create);
router.post('/:id/read', requireAuth, markRead);
router.delete('/:id', requireAuth, remove);

export default router;
