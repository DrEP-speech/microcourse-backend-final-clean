import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authBearer } from '../middleware/auth.js';

const router = Router();

function mkToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string')
      return res.status(400).json({ success:false, message:'email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ success:false, message:'password must be at least 8 chars' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success:false, message:'email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name });
    const token = mkToken(user);
    res.json({ success:true, token, user: { id:user._id, email:user.email, name:user.name } });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message || 'signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success:false, message:'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success:false, message:'invalid credentials' });
    const token = mkToken(user);
    res.json({ success:true, token, user: { id:user._id, email:user.email, name:user.name } });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message || 'login failed' });
  }
});

router.get('/me', authBearer, async (req, res) => {
  const user = await User.findById(req.user.id).select('_id email name createdAt');
  if (!user) return res.status(404).json({ success:false, message:'user not found' });
  res.json({ success:true, user });
});

export default router;
