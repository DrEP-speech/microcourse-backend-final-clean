// controllers/quizController.js
import Quiz from '../models/Quiz.js';
import QuizResult from '../models/QuizResult.js';

export const getAllQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find();
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
};

export const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
};

export const submitQuiz = async (req, res) => {
  try {
    const { studentId, quizId, answers } = req.body;
    // You can enhance this with AI scoring or adaptive logic later
    const correctAnswers = await Quiz.findById(quizId).select('questions');
    const total = correctAnswers.questions.length;
    let score = 0;

    answers.forEach((a, i) => {
      if (a === correctAnswers.questions[i].correctOption) score++;
    });

    const newResult = new QuizResult({
      student: studentId,
      quiz: quizId,
      answers,
      score: ((score / total) * 100).toFixed(2),
    });

    await newResult.save();
    res.json({ message: 'Quiz submitted', result: newResult });
  } catch (error) {
    res.status(500).json({ error: 'Submission failed' });
  }
};
