// models/Quiz.js
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  answer: String, // correct answer
});

const quizSchema = new mongoose.Schema({
  title: String,
  description: String,
  questions: [questionSchema],
});

export default mongoose.model('Quiz', quizSchema);
