import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      return res.status(200).json({ status: 'connected', db: mongoose.connection.name });
    } else {
      return res.status(500).json({ status: 'disconnected' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'DB check failed', details: err.message });
  }
});

export default router;
