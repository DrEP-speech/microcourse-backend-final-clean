import express from 'express';
import { listBadges, createBadge, awardBadge, syncBadge } from '../controllers/badgeController.js';
// import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// NOTE: previously you imported getPublicBadges — replace with listBadges to match controller exports.
router.get('/', listBadges);
router.post('/', /* requireAuth, */ createBadge);
router.post('/award', /* requireAuth, */ awardBadge);
router.post('/sync', /* requireAuth, */ syncBadge);

export default router;
