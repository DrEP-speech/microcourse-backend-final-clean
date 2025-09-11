import mongoose from 'mongoose';
const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    title: { type: String, required: true, index: true },
    description: { type: String },
    published: { type: Boolean, default: false },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// basic text index for q= searches
courseSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Course', courseSchema);


