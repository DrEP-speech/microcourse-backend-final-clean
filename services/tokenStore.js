// services/tokenStore.js
import Redis from 'ioredis';
import crypto from 'node:crypto';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 5 });

const REFRESH_PREFIX = 'refresh:';
const USER_SESS_PREFIX = 'userSessions:';

const uid = () => crypto.randomUUID();

/** Create a refresh-session jti for user, with TTL seconds. */
export async function createSession(userId, ttlSec, meta = {}) {
  const jti = uid();
  const key = REFRESH_PREFIX + jti;

  await redis.multi()
    .set(key, JSON.stringify({ userId, meta }), 'EX', ttlSec)
    .sadd(USER_SESS_PREFIX + userId, jti)
    .exec();

  return jti;
}

/** Return { userId, meta } or null. */
export async function validateSession(jti) {
  const raw = await redis.get(REFRESH_PREFIX + jti);
  return raw ? JSON.parse(raw) : null;
}

/** Revoke one session; optional userId to also remove from the set. */
export async function revokeSession(jti, userId) {
  const pipe = redis.multi().del(REFRESH_PREFIX + jti);
  if (userId) pipe.srem(USER_SESS_PREFIX + userId, jti);
  await pipe.exec();
}

/** Rotate: delete old, create new; returns new jti. */
export async function rotateSession(oldJti, userId, ttlSec, meta = {}) {
  await revokeSession(oldJti, userId);
  return createSession(userId, ttlSec, meta);
}

/** Revoke **all** sessions for a user. */
export async function revokeAllUserSessions(userId) {
  const setKey = USER_SESS_PREFIX + userId;
  const jtis = await redis.smembers(setKey);
  if (jtis.length) {
    const delKeys = jtis.map(j => REFRESH_PREFIX + j);
    await redis.del(...delKeys);
  }
  await redis.del(setKey);
}
