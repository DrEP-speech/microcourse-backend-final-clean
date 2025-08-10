// controllers/authController.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { asyncRoute, requireFields, ok, created, fail } from './_utils.js';

const signup = async (req, res) => {
  try {
    const { email, password, name, role = 'student' } = req.body || {};
    requireFields({ email, password, name }, ['email', 'password', 'name']);
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hash, name, role });
    return created(res, { id: user._id, email: user.email, role: user.role });
  } catch (err) { return fail(res, err); }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    requireFields({ email, password }, ['email', 'password']);
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const okPw = await bcrypt.compare(password, user.password);
    if (!okPw) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return ok(res, { token, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
  } catch (err) { return fail(res, err); }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('-password').lean();
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    return ok(res, user);
  } catch (err) { return fail(res, err); }
};

export { signup, login, me };
export default { signup: asyncRoute(signup), login: asyncRoute(login), me: asyncRoute(me) };
