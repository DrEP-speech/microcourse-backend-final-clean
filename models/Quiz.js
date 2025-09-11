// models/Quiz.js
import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

const QuestionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    choices: {
      type: [String],
      validate: v => Array.isArray(v) && v.length >= 2,
      default: []
    },
    correctIndex: {
      type: Number,
      min: 0,
      // We won't enforce max here at schema-level to allow editing; route will sanity-check if you want
    },
  },
  { _id: false }
);

const QuizSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    course: { type: Types.ObjectId, ref: 'Course', required: false, index: true },
    published: { type: Boolean, default: false, index: true },
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    questions: { type: [QuestionSchema], default: [] },
  },
  { timestamps: true }
);

QuizSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

export default model('Quiz', QuizSchema);
