// routes/emailRoutes.js
import express from 'express';
const router = express.Router();

router.post('/send', (req, res) => {
  res.send('POST send email');
});

router.get('/logs', (req, res) => {
  res.send('GET email logs');
});

export default router;
