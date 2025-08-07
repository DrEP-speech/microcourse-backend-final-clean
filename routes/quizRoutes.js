
// routes/quizRoutes.js
import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.send('GET all quizzes');
});

router.post('/submit', (req, res) => {
  res.send('POST submit quiz response');
});

export default router;
