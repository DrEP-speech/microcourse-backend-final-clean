// routes/authRoutes.js
import express from 'express';
const router = express.Router();

router.get('/google', (req, res) => {
  res.send('GET Google OAuth (future)');
});

router.get('/google/callback', (req, res) => {
  res.send('GET Google OAuth Callback (future)');
});

export default router;
