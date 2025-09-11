import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json([{ _id: 'c1', title: 'Demo Course' }]);
});

export default router;
