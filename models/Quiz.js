import mongoose from 'mongoose';
const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    prompt: { type: String, required: true },
    options: [{ type: String, required: true }],
    answerIndex: { type: Number, required: true },
    points: { type: Number, default: 1 },
  },
  { _id: false }
);

const quizSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    questions: { type: [questionSchema], default: [] },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
