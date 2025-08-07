// routes/instructorRoutes.js
import express from 'express';
const router = express.Router();

router.get('/quizzes', (req, res) => {
  res.send('GET instructor quiz list');
});

router.post('/quizzes', (req, res) => {
  res.send('POST create/edit quiz');
});

router.get('/submissions', (req, res) => {
  res.send('GET quiz submissions');
});

export default router;
