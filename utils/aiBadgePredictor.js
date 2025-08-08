// backend/utils/aiBadgePredictor.js
import Badge from '../models/Badge.js';

export const predictNextBadge = async (userStats) => {
  // Simple logic; replace with ML later
  const badges = await Badge.find().sort({ difficulty: 1 });
  for (let badge of badges) {
    if (!userStats.badges.includes(badge._id) && userStats.streak >= badge.streakRequirement) {
      return badge;
    }
  }
  return null;
};
