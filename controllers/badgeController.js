// controllers/badgeController.js
import Badge from '../models/Badge.js';

// ✅ Public: Fetch all public badges (no auth needed)
export const getPublicBadges = async (req, res) => {
  try {
    const badges = await Badge.find({ isPublic: true });
    res.status(200).json(badges);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load public badges' });
  }
};

// ✅ Admin: Get all badges
export const getAllBadges = async (req, res) => {
  try {
    const badges = await Badge.find();
    res.status(200).json(badges);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get badges' });
  }
};

// ✅ Admin: Get badge by ID
export const getBadgeById = async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.id);
    if (!badge) return res.status(404).json({ message: 'Badge not found' });
    res.status(200).json(badge);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get badge' });
  }
};

// ✅ Admin: Create a new badge
export const createBadge = async (req, res) => {
  try {
    const { name, description, icon, isPublic } = req.body;
    const badge = new Badge({ name, description, icon, isPublic });
    await badge.save();
    res.status(201).json(badge);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create badge' });
  }
};

// ✅ Admin: Update a badge
export const updateBadge = async (req, res) => {
  try {
    const updated = await Badge.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Badge not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update badge' });
  }
};

// ✅ Admin: Delete a badge
export const deleteBadge = async (req, res) => {
  try {
    const removed = await Badge.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Badge not found' });
    res.status(200).json({ message: 'Badge deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete badge' });
  }
};

// ✅ Admin: Award a badge to a user
export const awardBadgeToUser = async (req, res) => {
  try {
    const { userId, badgeId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.badges.includes(badgeId)) {
      user.badges.push(badgeId);
      await user.save();
    }

    res.status(200).json({ message: 'Badge awarded to user' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to award badge' });
  }
};

// ✅ Admin: Revoke badge from a user
export const revokeBadgeFromUser = async (req, res) => {
  try {
    const { userId, badgeId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.badges = user.badges.filter((id) => id.toString() !== badgeId);
    await user.save();

    res.status(200).json({ message: 'Badge revoked from user' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to revoke badge' });
  }
};
export const syncBadge = async (req, res) => {
  try {
    // Dummy logic — replace with your real badge sync logic
    res.status(200).json({ message: 'Badge sync completed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Badge sync failed.' });
  }
};
