const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'No access token' });
  const token = h.slice(7);

  try {
    const payload = jwt.verify(token, process.env.ACCESS_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'User inactive' });
    req.user = { id: user._id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt };
    next();
  } catch {
    return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'Invalid access token' });
  }
};
