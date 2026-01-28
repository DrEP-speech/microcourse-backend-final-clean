const jwt = require("jsonwebtoken");
const ms = require("ms");
const crypto = require("crypto");
const Refresh = require("../models/RefreshToken");
const Blacklist = require("../models/TokenBlacklist");

const ACCESS_TTL     = process.env.ACCESS_TTL   || "15m";
const REFRESH_TTL    = process.env.REFRESH_TTL  || "30d";
const ACCESS_SECRET  = process.env.ACCESS_SECRET  || "dev-access-secret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "dev-refresh-secret";

function signAccess(user) {
  const payload = { sub: String(user._id), email: user.email, role: user.role || "user" };
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

async function mintAndStoreRefresh(userId) {
  const expMs = ms(REFRESH_TTL);
  const expAt = new Date(Date.now() + expMs);

  // Try up to 3 times in the extremely rare case of token collision
  for (let i = 0; i < 3; i++) {
    const jti = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const token = jwt.sign({ sub: String(userId) }, REFRESH_SECRET, {
      expiresIn: REFRESH_TTL,
      jwtid: jti,
    });

    try {
      await Refresh.create({ token, user: userId, expAt });
      return { refreshToken: token, maxAgeMs: expMs };
    } catch (e) {
      // E11000 duplicate key -> retry with a new jti
      const msg = String(e && e.message || "");
      if (msg.includes("E11000") && msg.includes("token_1")) continue;
      throw e;
    }
  }
  const err = new Error("Failed to mint unique refresh token after retries");
  err.status = 500;
  throw err;
}

async function verifyRefresh(token) {
  const bl = await Blacklist.findOne({ token });
  if (bl) {
    const e = new Error("Token revoked");
    e.status = 401;
    throw e;
  }
  const stored = await Refresh.findOne({ token });
  if (!stored) {
    const e = new Error("Unknown refresh token");
    e.status = 401;
    throw e;
  }
  const payload = jwt.verify(token, REFRESH_SECRET);
  return { userId: payload.sub };
}

async function blacklistRefresh(token) {
  await Refresh.deleteOne({ token });
  await Blacklist.updateOne(
    { token },
    { $set: { token, revokedAt: new Date() } },
    { upsert: true }
  );
}

module.exports = {
  signAccess,
  verifyAccess,
  mintAndStoreRefresh,
  verifyRefresh,
  blacklistRefresh,
};
