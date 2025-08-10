// controllers/badgeController.js
import Badge from '../models/Badge.js';
import User from '../models/User.js';

/** Create a new badge */
const createBadge = async (req, res) => {
  try {
    const { key, name, description = '', iconUrl = '', points = 0 } = req.body || {};
    if (!key || !name) {
      return res.status(400).json({ success: false, message: 'key and name are required' });
    }
    const exists = await Badge.findOne({ key }).lean();
    if (exists) return res.status(409).json({ success: false, message: 'Badge key already exists' });

    const badge = await Badge.create({ key, name, description, iconUrl, points });
    return res.status(201).json({ success: true, data: { id: badge._id } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

/** Get all badges */
const getAllBadges = async (_req, res) => {
  try {
    const badges = await Badge.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: badges });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

/** Award a badge to a user */
const unlockBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.body || {};
    if (!userId || !badgeId) {
      return res.status(400).json({ success: false, message: 'userId and badgeId are required' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.badges = user.badges || [];
    const idStr = String(badgeId);
    if (!user.badges.find((b) => String(b) === idStr)) user.badges.push(badgeId);
    await user.save();

    return res.status(200).json({ success: true, data: { badges: user.badges } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

/** Sync badges: add any missing ids (idempotent merge) */
const syncBadge = async (req, res) => {
  try {
    const { userId, badgeIds = [] } = req.body || {};
    if (!userId || !Array.isArray(badgeIds)) {
      return res.status(400).json({ success: false, message: 'userId and badgeIds[] are required' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const current = (user.badges || []).map(String);
    const incoming = badgeIds.map(String);
    const merged = Array.from(new Set([...current, ...incoming]));
    user.badges = merged;
    await user.save();

    return res.status(200).json({ success: true, data: { badges: user.badges } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

/** Hard delete a badge (admin) */
const deleteBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Badge.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Badge not found' });
    return res.status(200).json({ success: true, data: { id: deleted._id } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

/* One clean export block (no inline exports) */
export {
  createBadge,
  getAllBadges,
  getAllBadges as listBadges,
  getAllBadges as getPublicBadges,
  unlockBadge,
  unlockBadge as awardBadge,   // ← add this alias
  syncBadge,
  deleteBadge,
};

