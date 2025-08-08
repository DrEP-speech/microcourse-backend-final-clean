// routes/badgeRoutes.js
import express from 'express';
import {
  unlockBadge,
  getPublicBadges,
  syncBadge
} from '../controllers/badgeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/unlock', protect, unlockBadge);
router.get('/public', getPublicBadges);
router.post('/sync', protect, syncBadge);

export default router;
