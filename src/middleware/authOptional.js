const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function authOptional(req, res, next) {
  try {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) return next();

    const token = header.slice(7).trim();
    const secret = process.env.JWT_SECRET;
    if (!secret) return next();

    const decoded = jwt.verify(token, secret);
    const userId = decoded.id || decoded._id || decoded.userId;
    if (!userId) return next();

    const user = await User.findById(userId).select('_id email role name').lean();
    if (user) req.user = user;

    return next();
  } catch {
    return next();
  }
};
