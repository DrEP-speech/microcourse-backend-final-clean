// controllers/badgeController.js (add)
import { /* existing imports */ } from './_utils.js';
import Badge from '../models/Badge.js';
import User from '../models/User.js';

// ...

  try {
    const del = await Badge.findByIdAndDelete(req.params.id).lean();
    if (!del) return res.status(404).json({ success: false, message: 'Badge not found' });
    return res.status(200).json({ success: true, data: { id: del._id } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

const deleteBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Badge.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Badge not found.' });
    return res.status(200).json({ success: true, data: { id: deleted._id } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

export {
  createBadge,
  getAllBadges,
  getAllBadges as listBadges, // alias for routes expecting `listBadges`
  getBadgeById,
  updateBadge,
  softDeleteBadge,
  restoreBadge,
  hardDeleteBadge,
  deleteBadge,                // the new one you added
  unlockBadge,
  syncBadge,
  bulkUpsertBadges,
  getBadgeStats,
};