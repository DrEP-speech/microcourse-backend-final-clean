// models/Quiz.js
import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

const QuestionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    choices: {
      type: [String],
      validate: v => Array.isArray(v) && v.length >= 2,
      default: [],
    },
    correctIndex: { type: Number, min: 0 },
  },
  { _id: false }
);

const QuizSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    // REQUIRED: every quiz is attached to a course
    course: { type: Types.ObjectId, ref: 'Course', required: true, index: true },
    published: { type: Boolean, default: false, index: true },
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    questions: { type: [QuestionSchema], default: [] },
  },
  { timestamps: true }
);

// helpful compound indexes
QuizSchema.index({ owner: 1, course: 1, createdAt: -1 });
QuizSchema.index({ course: 1, published: 1, createdAt: -1 });

QuizSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

export default model('Quiz', QuizSchema);
