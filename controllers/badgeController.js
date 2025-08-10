// controllers/badgeController.js
import Badge from '../models/Badge.js';
import User from '../models/User.js';
import { asyncRoute, parsePagination, ok, created, fail, requireFields } from './_utils.js';

const listBadges = async (req, res) => {
  try {
    const { skip, limit, sort, page } = parsePagination(req);
    const [items, total] = await Promise.all([
      Badge.find().sort(sort).skip(skip).limit(limit).lean(),
      Badge.countDocuments(),
    ]);
    return ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return fail(res, err); }
};

const createBadge = async (req, res) => {
  try {
    const { key, name } = req.body || {};
    requireFields({ key, name }, ['key', 'name']);
    const dup = await Badge.findOne({ key }).lean();
    if (dup) return res.status(409).json({ success: false, message: 'Badge key exists' });
    const b = await Badge.create(req.body);
    return created(res, { id: b._id });
  } catch (err) { return fail(res, err); }
};

const awardBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.body || {};
    requireFields({ userId, badgeId }, ['userId', 'badgeId']);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.badges?.some((id) => id.toString() === badgeId)) {
      user.badges = [...(user.badges || []), badgeId];
      await user.save();
    }
    return ok(res, { badges: user.badges });
  } catch (err) { return fail(res, err); }
};

const syncBadge = async (req, res) => {
  try {
    const { userId, badgeIds = [] } = req.body || {};
    requireFields({ userId }, ['userId']);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const set = new Set([...(user.badges || []).map(String), ...badgeIds.map(String)]);
    user.badges = [...set];
    await user.save();
    return ok(res, { badges: user.badges });
  } catch (err) { return fail(res, err); }
};

export { listBadges, createBadge, awardBadge, syncBadge };
export default {
  listBadges: asyncRoute(listBadges),
  createBadge: asyncRoute(createBadge),
  awardBadge: asyncRoute(awardBadge),
  syncBadge: asyncRoute(syncBadge),
};
