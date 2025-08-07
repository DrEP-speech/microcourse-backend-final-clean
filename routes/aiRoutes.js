// routes/aiRoutes.js
import express from 'express';
const router = express.Router();

router.post('/quiz-feedback', (req, res) => {
  res.send('POST generate AI quiz feedback');
});

export default router;
