import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
const router = Router();

router.get('/', requireAuth, (_req, res) => res.json({ ok: true }));

export default router;
