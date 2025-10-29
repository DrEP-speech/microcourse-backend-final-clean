// routes/lessonAssets.js
const router = require('express').Router();
const LessonAsset = require('../models/LessonAsset');

// POST /api/lessons/:lessonId/assets
router.post('/lessons/:lessonId/assets', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { type, url, title, durationMs, thumbnailUrl, jobId, provider, metadata } = req.body || {};

    if (type !== 'video' || !url) {
      return res.status(400).json({ message: 'Expected { type: "video", url }' });
    }

    const asset = await LessonAsset.create({
      lessonId, type, url, title, durationMs, thumbnailUrl, jobId, provider, metadata,
    });

    return res.status(201).json(asset);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to create lesson asset' });
  }
});

// GET /api/lessons/:lessonId/assets
router.get('/lessons/:lessonId/assets', async (req, res) => {
  const { lessonId } = req.params;
  const rows = await LessonAsset.find({ lessonId }).sort({ createdAt: -1 }).lean();
  res.json(rows);
});

module.exports = router;
