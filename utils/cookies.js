function boolEnv(v, fallback = false) {
  if (typeof v === 'undefined') return fallback;
  return String(v).trim() === '1' || String(v).toLowerCase() === 'true';
}

function cookieNames() {
  return {
    at: process.env.COOKIE_NAME_AT || 'mc_at',
    rt: process.env.COOKIE_NAME_RT || 'mc_rt',
  };
}

function cookieFlags() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // If behind reverse proxy (Render, Railway, Nginx), set TRUST_PROXY=1
  const secure = boolEnv(process.env.COOKIE_SECURE, nodeEnv === 'production');
  const sameSite = (process.env.COOKIE_SAMESITE || (nodeEnv === 'production' ? 'none' : 'lax')).toLowerCase();

  // NOTE: cross-site cookie requires: SameSite=None + Secure=true + CORS credentials
  return {
    httpOnly: true,
    secure,
    sameSite: sameSite === 'none' ? 'none' : 'lax',
    path: '/',
  };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const names = cookieNames();
  const flags = cookieFlags();

  // Short access cookie (browser will keep until expires)
  const accessMaxAgeMs = (parseInt(process.env.ACCESS_TTL_MIN || '15', 10) * 60 * 1000);
  const refreshMaxAgeMs = (parseInt(process.env.REFRESH_TTL_DAYS || '7', 10) * 24 * 60 * 60 * 1000);

  res.cookie(names.at, accessToken, { ...flags, maxAge: accessMaxAgeMs });
  res.cookie(names.rt, refreshToken, { ...flags, maxAge: refreshMaxAgeMs });
}

function clearAuthCookies(res) {
  const names = cookieNames();
  const flags = cookieFlags();
  res.clearCookie(names.at, { ...flags, maxAge: 0 });
  res.clearCookie(names.rt, { ...flags, maxAge: 0 });
}

module.exports = {
  cookieNames,
  cookieFlags,
  setAuthCookies,
  clearAuthCookies,
};