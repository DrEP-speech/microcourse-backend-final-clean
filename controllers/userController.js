// controllers/userController.js
import User from '../models/User.js';
import { asyncRoute, parsePagination, ok, created, fail } from './_utils.js';

const listUsers = async (req, res) => {
  try {
    const { skip, limit, sort, page } = parsePagination(req);
    const [items, total] = await Promise.all([
      User.find().select('-password').sort(sort).skip(skip).limit(limit).lean(),
      User.countDocuments(),
    ]);
    return ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return fail(res, err); }
};

const getUser = async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select('-password').lean();
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });
    return ok(res, u);
  } catch (err) { return fail(res, err); }
};

const createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    return created(res, { id: user._id });
  } catch (err) { return fail(res, err); }
};

const updateUser = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password').lean();
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
    return ok(res, updated);
  } catch (err) { return fail(res, err); }
};

const deleteUser = async (req, res) => {
  try {
    const del = await User.findByIdAndDelete(req.params.id).lean();
    if (!del) return res.status(404).json({ success: false, message: 'User not found' });
    return ok(res, { id: del._id });
  } catch (err) { return fail(res, err); }
};

export { listUsers, getUser, createUser, updateUser, deleteUser };
export default {
  listUsers: asyncRoute(listUsers),
  getUser: asyncRoute(getUser),
  createUser: asyncRoute(createUser),
  updateUser: asyncRoute(updateUser),
  deleteUser: asyncRoute(deleteUser),
};
