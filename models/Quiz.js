import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const questionSchema = new Schema({
  text:         { type: String, required: true },
  choices:      { type: [String], required: true, validate: v => Array.isArray(v) && v.length >= 2 },
  correctIndex: { type: Number, default: 0 },
}, { _id: false });

const quizSchema = new Schema(
  {
    title:       { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    course:      { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    owner:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    published:   { type: Boolean, default: false, index: true },
    questions:   { type: [questionSchema], default: [] },

    // soft-delete + audit
    deleted:     { type: Boolean, default: false, index: true },
    deletedAt:   { type: Date },
    deletedBy:   { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:   { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

quizSchema.index({ course: 1, createdAt: -1 });
quizSchema.index({ owner: 1, createdAt: -1 });
quizSchema.index({ published: 1, createdAt: -1 });

export default model('Quiz', quizSchema);



