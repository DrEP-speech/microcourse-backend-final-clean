// controllers/badgeController.js (add)
import { /* existing imports */ } from './_utils.js';
import Badge from '../models/Badge.js';
import User from '../models/User.js';

// ...

const deleteBadge = async (req, res) => {
  try {
    const del = await Badge.findByIdAndDelete(req.params.id).lean();
    if (!del) return res.status(404).json({ success: false, message: 'Badge not found' });
    return res.status(200).json({ success: true, data: { id: del._id } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

export { /* existing named exports */, deleteBadge };
export default {
  /* existing defaults */,
  deleteBadge,
};
