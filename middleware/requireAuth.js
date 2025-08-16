// middleware/requireAuth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const { JWT_SECRET = 'change-me', ACCESS_COOKIE_NAME = 'mc_token' } = process.env;

export default async function requireAuth(req, res, next) {
  try {
    let token;
    const auth = req.headers?.authorization || '';
    if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();
    if (!token && req.cookies) token = req.cookies[ACCESS_COOKIE_NAME];

    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
