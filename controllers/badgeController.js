// controllers/badgeController.js

import Badge from '../models/Badge.js';
import User from '../models/User.js';

// Create a new badge
const createBadge = async (req, res) => {
  try {
    const { name, description, icon, criteria } = req.body;
    const badge = new Badge({ name, description, icon, criteria });
    await badge.save();
    res.status(201).json({ success: true, badge });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
};

// Get all badges
const getAllBadges = async (req, res) => {
  try {
    const badges = await Badge.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, badges });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
};

// Unlock badge for user
const unlockBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.badges.includes(badgeId)) {
      user.badges.push(badgeId);
      await user.save();
    }

    res.status(200).json({ success: true, badges: user.badges });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
};

// Auto-sync badge based on score
const syncBadge = async (req, res) => {
  try {
    const { userId, score } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const badge = await Badge.findOne({ criteria: 'score_90' });
    if (!badge) return res.status(404).json({ success: false, message: 'Badge not found' });

    if (score >= 90 && !user.badges.includes(badge._id)) {
      user.badges.push(badge._id);
      await user.save();
    }

    res.status(200).json({ success: true, badges: user.badges });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
};

// ✅ Only one export block — no duplicates!
export {
  createBadge,
  getAllBadges,
  unlockBadge,
  syncBadge
};
