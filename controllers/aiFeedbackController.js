// controllers/aiFeedbackController.js

import { generateAIQuizFeedback } from '../services/aiEngine.js';

export const generateFeedback = async (req, res) => {
  try {
    const { quizId, studentId } = req.body;
    const feedback = await generateAIQuizFeedback(quizId, studentId);
    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: 'AI feedback generation failed', details: err.message });
  }
};
