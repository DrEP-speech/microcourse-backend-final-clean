export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success:false, message:'Missing token' });
  if (!req.user.role || !roles.includes(req.user.role))
    return res.status(403).json({ success:false, message:'Forbidden' });
  next();
};
