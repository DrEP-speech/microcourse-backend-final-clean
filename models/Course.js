// models/Course.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const courseSchema = new Schema(
  {
    title:       { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    published:   { type: Boolean, default: false, index: true },
    owner:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

// Helpful indexes (define on the *schema* variable)
courseSchema.index({ owner: 1, createdAt: -1 });
courseSchema.index({ published: 1, createdAt: -1 });

export default model('Course', courseSchema);


