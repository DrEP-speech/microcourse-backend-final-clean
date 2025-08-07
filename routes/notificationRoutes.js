// routes/notificationRoutes.js
import express from 'express';
const router = express.Router();

router.post('/send', (req, res) => {
  res.send('POST send notification');
});

router.get('/student/:id', (req, res) => {
  res.send('GET student notifications');
});

export default router;
