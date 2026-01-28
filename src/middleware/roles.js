// src/middleware/roles.js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ success:false, message:'Unauthorized' });
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ success:false, message:'Forbidden: insufficient role' });
    }
    next();
  };
}
module.exports = { requireRole };
