import mongoose from 'mongoose';
const { Schema } = mongoose;

const answerSchema = new Schema(
  {
    questionIndex: { type: Number, required: true },
    chosenIndex: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const quizResultSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', index: true, required: true },
    score: { type: Number, required: true },
    answers: { type: [answerSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.QuizResult || mongoose.model('QuizResult', quizResultSchema);
