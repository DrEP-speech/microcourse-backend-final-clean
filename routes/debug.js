import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Debug route working', env: process.env.NODE_ENV || 'development' });
});

export default router;
