// controllers/notificationController.js
import Notification from '../models/Notification.js';
import { asyncRoute, parsePagination, ok, created, fail, requireFields } from './_utils.js';

const listNotifications = async (req, res) => {
  try {
    const { skip, limit, sort, page } = parsePagination(req);
    const filter = req.query.userId ? { user: req.query.userId } : {};
    const [items, total] = await Promise.all([
      Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);
    return ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return fail(res, err); }
};

const createNotification = async (req, res) => {
  try {
    requireFields(req.body || {}, ['user', 'type', 'message']);
    const n = await Notification.create(req.body);
    return created(res, { id: n._id });
  } catch (err) { return fail(res, err); }
};

const markRead = async (req, res) => {
  try {
    const n = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true }).lean();
    if (!n) return res.status(404).json({ success: false, message: 'Not found' });
    return ok(res, n);
  } catch (err) { return fail(res, err); }
};

export { listNotifications, createNotification, markRead };
export default {
  listNotifications: asyncRoute(listNotifications),
  createNotification: asyncRoute(createNotification),
  markRead: asyncRoute(markRead),
};
