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