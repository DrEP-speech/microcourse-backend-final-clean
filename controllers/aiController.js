// controllers/aiController.js
export const generateAIQuizFeedback = async (req, res) => {
  try {
    const { quizResultId } = req.body;

    // Placeholder for AI logic
    const feedback = {
      summary: 'You performed well on multiple choice but struggled with short answers.',
      recommendations: ['Review chapters 3–4', 'Practice summarizing key points.'],
    };

    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate AI feedback' });
  }
};
