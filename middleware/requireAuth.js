// ESM, named export only
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.mc_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid/expired token' });
  }
}
