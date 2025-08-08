// controllers/badgeController.js
import asyncHandler from 'express-async-handler';
import Badge from '../models/Badge.js';
import User from '../models/User.js';

// @desc    Sync badges from analytics or logic engine
// @route   POST /api/badges/sync
// @access  Private/Admin
export const syncBadge = asyncHandler(async (req, res) => {
  const { userId, badgeType, details } = req.body;

  if (!userId || !badgeType) {
    res.status(400);
    throw new Error('Missing required badge fields');
  }

  const badge = await Badge.create({
    user: userId,
    type: badgeType,
    details,
    awardedAt: new Date(),
  });

  await User.findByIdAndUpdate(userId, {
    $addToSet: { badges: badge._id },
  });

  res.status(201).json({ message: 'Badge synced', badge });
});

// @desc    Get all badges for admin view
// @route   GET /api/badges
// @access  Private/Admin
export const getAllBadges = asyncHandler(async (req, res) => {
  const badges = await Badge.find().populate('user', 'name email');
  res.json(badges);
});

// @desc    Create a new badge manually
// @route   POST /api/badges
// @access  Private/Admin
export const createBadge = asyncHandler(async (req, res) => {
  const { user, type, details } = req.body;

  if (!user || !type) {
    res.status(400);
    throw new Error('User and type are required');
  }

  const newBadge = await Badge.create({
    user,
    type,
    details,
    awardedAt: new Date(),
  });

  await User.findByIdAndUpdate(user, {
    $addToSet: { badges: newBadge._id },
  });

  res.status(201).json({ message: 'Badge created', badge: newBadge });
});

// @desc    Unlock badge for user manually (e.g., quiz milestone)
// @route   PATCH /api/badges/unlock
// @access  Private
export const unlockBadge = asyncHandler(async (req, res) => {
  const { badgeType, details } = req.body;
  const userId = req.user._id;

  if (!badgeType) {
    res.status(400);
    throw new Error('Badge type is required');
  }

  const badge = await Badge.create({
    user: userId,
    type: badgeType,
    details,
    awardedAt: new Date(),
  });

  await User.findByIdAndUpdate(userId, {
    $addToSet: { badges: badge._id },
  });

  res.status(201).json({ message: 'Badge unlocked', badge });
});

// ✅ Ensure all are exported
export {
  syncBadge,
  getAllBadges,
  createBadge,
  unlockBadge,
};
