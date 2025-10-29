// models/LessonAsset.js
const { Schema, model } = require('mongoose');

const lessonAssetSchema = new Schema(
  {
    lessonId: { type: String, required: true, index: true },
    type: { type: String, enum: ['video'], required: true },
    url: { type: String, required: true },
    title: String,
    durationMs: Number,
    thumbnailUrl: String,
    jobId: String,
    provider: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = model('LessonAsset', lessonAssetSchema);
