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
// after defining CourseSchema
CourseSchema.index({ owner: 1, createdAt: -1 });
CourseSchema.index({ title: 1 });
CourseSchema.index({ published: 1, createdAt: -1 });

export default mongoose.model('Course', courseSchema);


