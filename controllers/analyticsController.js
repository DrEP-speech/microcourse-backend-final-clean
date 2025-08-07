// controllers/analyticsController.js
import QuizResult from '../models/QuizResult.js';

export const getStudentAnalytics = async (req, res) => {
  try {
    const { studentId } = req.params;
    const results = await QuizResult.find({ student: studentId }).populate('quiz');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load analytics' });
  }
};

export const getQuizPerformance = async (req, res) => {
  try {
    const { quizId } = req.params;
    const results = await QuizResult.find({ quiz: quizId });

    const avgScore = results.reduce((sum, r) => sum + Number(r.score), 0) / results.length;

    res.json({
      count: results.length,
      averageScore: avgScore.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
};
