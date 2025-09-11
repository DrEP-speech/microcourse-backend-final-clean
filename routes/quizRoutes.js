import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json([{ _id: 'q1', title: 'Demo Quiz' }]);
});

export default router;
