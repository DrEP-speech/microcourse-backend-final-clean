import jwt from 'jsonwebtoken';

export function authBearer(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ success:false, message:'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email }
    next();
  } catch {
    res.status(401).json({ success:false, message:'Invalid token' });
  }
}
