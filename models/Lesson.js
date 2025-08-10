import mongoose from 'mongoose';
const { Schema } = mongoose;

const lessonSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },     // markdown or HTML
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    durationMin: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Lesson || mongoose.model('Lesson', lessonSchema);
