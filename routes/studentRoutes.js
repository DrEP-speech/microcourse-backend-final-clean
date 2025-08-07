// routes/studentRoutes.js
import express from 'express';
const router = express.Router();

router.get('/courses', (req, res) => {
  res.send('GET student courses');
});

router.get('/quiz-results', (req, res) => {
  res.send('GET student quiz results');
});

router.get('/quizzes/:quizId', (req, res) => {
  res.send('GET specific quiz data');
});

export default router;
