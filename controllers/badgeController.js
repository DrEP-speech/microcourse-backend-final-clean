// controllers/badgeController.js

import Badge from '../models/Badge.js';
import User from '../models/User.js';

// @desc    Create a new badge
// @route   POST /api/badges
export const createBadge = async (req, res) => {
  try {
    const { name, description, icon, criteria } = req.body;

    const badge = new Badge({ name, description, icon, criteria });
    await badge.save();

    res.status(201).json({ success: true, badge });
  } catch (error) {
    console.error('createBadge error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get all badges
// @route   GET /api/badges
export const getAllBadges = async (req, res) => {
  try {
    const badges = await Badge.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, badges });
  } catch (error) {
    console.error('getAllBadges error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Unlock badge for a user
// @route   POST /api/badges/unlock
export const unlockBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.badges.includes(badgeId)) {
      user.badges.push(badgeId);
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Badge unlocked', badges: user.badges });
  } catch (error) {
    console.error('unlockBadge error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Sync badge logic (placeholder for automation or worker sync)
// @route   POST /api/badges/sync
export const syncBadge = async (req, res) => {
  try {
    const { userId, score } = req.body;

    // Example logic: award badge if score >= 90
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const badge = await Badge.findOne({ criteria: 'score_90' });
    if (!badge) return res.status(404).json({ success: false, message: 'Badge not found' });

    if (score >= 90 && !user.badges.includes(badge._id)) {
      user.badges.push(badge._id);
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Badge sync complete', badges: user.badges });
  } catch (error) {
    console.error('syncBadge error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ✅ Single Export Statement
export {
  createBadge,
  getAllBadges,
  unlockBadge,
  syncBadge
};
