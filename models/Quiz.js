import mongoose from 'mongoose';
const { Schema } = mongoose;

const quizSchema = new Schema(
  {
    title: { type: String, required: true, index: true },
    description: { type: String },
    published: { type: Boolean, default: false },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

quizSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Quiz', quizSchema);
