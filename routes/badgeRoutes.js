import express from 'express';
import { listBadges, createBadge, awardBadge, syncBadge, deleteBadge } from '../controllers/badgeController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listBadges);
router.post('/', requireAuth, requireRole('admin'), createBadge);
router.delete('/:id', requireAuth, requireRole('admin'), deleteBadge);

router.post('/award', requireAuth, awardBadge);
router.post('/sync', requireAuth, syncBadge);

export default router;
