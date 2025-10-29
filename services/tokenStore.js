import IORedis from "ioredis";
class TokenStore {
  constructor() {
    this.redisUrl = process.env.REDIS_URL || "";
    this.redis = null;
    this.memory = new Map();
  }
  async #ensureRedis() {
    if (!this.redisUrl) return false;
    if (this.redis) return true;
    try {
      this.redis = new IORedis(this.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableAutoPipelining: true });
      this.redis.on("error", () => {});
      await this.redis.connect();
      return true;
    } catch {
      this.redis = null; return false;
    }
  }
  async saveSession(sessionId, userId, ttlSeconds) {
    if (await this.#ensureRedis()) {
      const cli = this.redis;
      await cli.setex(`sess:${sessionId}`, ttlSeconds, userId);
      await cli.sadd(`user:${userId}:sessions`, sessionId);
      await cli.expire(`user:${userId}:sessions`, ttlSeconds);
      return;
    }
    const exp = Date.now() + ttlSeconds * 1000;
    this.memory.set(sessionId, { userId, exp });
  }
  async sessionExists(sessionId) {
    if (await this.#ensureRedis()) return (await this.redis.exists(`sess:${sessionId}`)) === 1;
    const rec = this.memory.get(sessionId);
    if (!rec) return false;
    if (rec.exp < Date.now()) { this.memory.delete(sessionId); return false; }
    return true;
  }
  async revokeAllForUser(userId) {
    if (await this.#ensureRedis()) {
      const key = `user:${userId}:sessions`;
      const members = await this.redis.smembers(key);
      if (members?.length) {
        const pipe = this.redis.pipeline();
        for (const sid of members) pipe.del(`sess:${sid}`);
        pipe.del(key);
        await pipe.exec();
      }
      return;
    }
    for (const [sid, rec] of this.memory.entries()) {
      if (rec.userId === userId) this.memory.delete(sid);
    }
  }
}
export const tokenStore = new TokenStore();

const User = require('../models/User');
const tokens = require('../services/tokenService');
const { AppError, asyncHandler } = require('../utils/http');

const setRefreshCookie = (res, value, maxAgeMs) => {
  const isProd = process.env.NODE_ENV !== 'development';
  res.cookie('refreshToken', value, {
    httpOnly: true,
    secure: isProd,                         // true in prod (HTTPS)
    sameSite: isProd ? 'None' : 'Lax',      // None for cross-site in prod
    path: '/api/auth/refresh',              // send only to refresh route
    maxAge: maxAgeMs,
  });
};

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new AppError(400, 'Email and password required');

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw new AppError(401, 'Invalid credentials');

  const ok = await user.comparePassword(password);
  if (!ok) throw new AppError(401, 'Invalid credentials');

  const accessToken  = tokens.signAccess(user);
  const { refreshToken, maxAgeMs } = await tokens.mintAndStoreRefresh(user._id);

  setRefreshCookie(res, refreshToken, maxAgeMs);

  // keep your existing shape { success, token }
  res.json({ success: true, token: accessToken });
});

exports.refresh = asyncHandler(async (req, res) => {
  // accept cookie OR header for non-browsers
  const headerBearer = req.header('authorization')?.split(' ')[1];
  const headerX      = req.header('x-refresh') || req.header('x-refresh-token');
  const cookieRt     = req.cookies?.refreshToken;
  const rt = cookieRt || headerX || headerBearer;

  if (!rt) throw new AppError(401, 'No refresh token');

  const { userId } = await tokens.verifyRefresh(rt); // verifies + checks blacklist
  const user = await User.findById(userId);
  if (!user) throw new AppError(401, 'Account not found');

  // rotate refresh
  await tokens.blacklistRefresh(rt);
  const accessToken  = tokens.signAccess(user);
  const { refreshToken, maxAgeMs } = await tokens.mintAndStoreRefresh(user._id);

  // only set cookie if caller used cookie; header callers can keep header flow
  if (cookieRt) setRefreshCookie(res, refreshToken, maxAgeMs);

  res.json({ success: true, accessToken });
});

exports.logout = asyncHandler(async (req, res) => {
  const cookieRt = req.cookies?.refreshToken;
  const headerRt = req.header('x-refresh') || req.header('x-refresh-token')
                 || req.header('authorization')?.split(' ')[1];

  if (cookieRt) await tokens.blacklistRefresh(cookieRt);
  if (headerRt) await tokens.blacklistRefresh(headerRt);

  // clear cookie if it exists
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ success: true, message: 'Logged out' });
});

// middleware + profile
exports.requireAuth = asyncHandler(async (req, _res, next) => {
  const auth = req.header('authorization');
  if (!auth) throw new AppError(401, 'Missing Authorization header');

  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') throw new AppError(401, 'Invalid Authorization format');

  const payload = tokens.verifyAccess(parts[1]);
  req.user = { id: payload.sub, email: payload.email, role: payload.role };
  next();
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) throw new AppError(404, 'User not found');
  res.json({ success: true, user });
});
