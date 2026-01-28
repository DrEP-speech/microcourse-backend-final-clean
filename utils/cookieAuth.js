const jwt = require('jsonwebtoken');

function cookieOptions(req, { maxAgeMs, httpOnly = true } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly,
    secure: isProd,
    sameSite: isProd ? 'lax' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

function signAccess(payload) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRES || '15m';
  return jwt.sign(payload, secret, { expiresIn });
}

function signRefresh(payload) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_REFRESH_EXPIRES || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

function verify(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { cookieOptions, signAccess, signRefresh, verify };