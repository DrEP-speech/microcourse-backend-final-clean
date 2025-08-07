// routes/student.js
router.get('/quizzes/:quizId', async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId).select('-answers'); // don't send correct answers
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  res.json(quiz);
});
