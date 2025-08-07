// routes/analyticsRoutes.js
import express from 'express';
const router = express.Router();

router.get('/student/:studentId', (req, res) => {
  res.send('GET student-level analytics');
});

router.get('/quiz/:quizId', (req, res) => {
  res.send('GET quiz-level analytics');
});

export default router;
