// models/QuizResult.js
import mongoose from 'mongoose';

const quizResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  answers: [String],
  score: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('QuizResult', quizResultSchema);
