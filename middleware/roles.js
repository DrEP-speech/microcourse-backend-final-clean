// middleware/roles.js
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user?.role) return res.status(403).json({ success:false, message:'Forbidden' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ success:false, message:'Forbidden' });
  next();
};
