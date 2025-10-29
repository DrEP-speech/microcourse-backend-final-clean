const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ms = require('ms');
const User = require('../models/User');
const Refresh = require('../models/RefreshToken');

const ACCESS_TTL_MS  = ms(process.env.ACCESS_TTL  || '15m');
const REFRESH_TTL_MS = ms(process.env.REFRESH_TTL || '30d');

function signAccess(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    process.env.ACCESS_SECRET,
    { expiresIn: Math.floor(ACCESS_TTL_MS / 1000) }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.REFRESH_SECRET,
    { expiresIn: Math.floor(REFRESH_TTL_MS / 1000) }
  );
}

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email }).select('+password');
  if (!user) return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'Invalid credentials' });

  user.lastLoginAt = new Date(); await user.save();

  // optional single-session policy
  await Refresh.deleteMany({ user: user._id });

  const access = signAccess(user);
  const refresh = signRefresh(user);
  const exp = new Date(Date.now() + REFRESH_TTL_MS);

  await Refresh.create({ user: user._id, token: refresh, expiresAt: exp });

  // Set cookie path to refresh route to avoid leaking cookie broadly
  res.cookie('refreshToken', refresh, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TTL_MS
  });

  return res.json({
    success: true,
    token: access,
    user: { id: user._id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt }
  });
};

exports.refresh = async (req, res) => {
  // prefer cookie; allow header Authorization: Bearer <refresh>
  const fromCookie = req.cookies?.refreshToken;
  const fromHeader = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : null;
  const token = fromCookie || fromHeader;
  if (!token) return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'No refresh token' });

  let payload;
  try { payload = jwt.verify(token, process.env.REFRESH_SECRET); }
  catch { return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'Invalid refresh token' }); }

  const found = await Refresh.findOne({ token });
  if (!found) return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'Refresh token not found' });

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) return res.status(401).json({ success:false, code:'REQUEST_ERROR', message:'User inactive' });

  const access = signAccess(user);
  return res.json({ success: true, token: access });
};

exports.me = async (req, res) => {
  // req.user set by auth middleware
  return res.json({ success: true, user: req.user });
};

exports.logout = async (req, res) => {
  const rt = req.cookies?.refreshToken;
  if (rt) await Refresh.deleteOne({ token: rt });
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  return res.json({ success: true });
};
