import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { tokenStore } from "../services/tokenStore.js";   // Redis/In-mem store (safe if missing, see our service)
import { requireEnv } from "../utils/requireEnv.js";      // tiny helper (we inline fallback below if you don’t have it)
import User from "../models/User.js";                     // adjust path if your model lives elsewhere

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TTL_S  = Number(process.env.ACCESS_TTL_S  || 15 * 60);      // 15m
const REFRESH_TTL_S = Number(process.env.REFRESH_TTL_S || 30 * 24 * 3600); // 30d
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


/* ---------------- helpers ---------------- */

function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TTL_S });
}
function signRefreshToken(sessionId, userId) {
  return jwt.sign({ sid: sessionId, sub: userId }, JWT_SECRET, { expiresIn: REFRESH_TTL_S });
}

/**
 * Sets mc_token (access) and mc_refresh (refresh) cookies.
 * Persists the refresh in tokenStore under sessionId.
 */
export async function issueSessionCookiesForUser(res, userId, req) {
  const sessionId = cryptoRandom();
  const access  = signAccessToken(userId);
  const refresh = signRefreshToken(sessionId, userId);

  // persist refresh session -> user
  await tokenStore.saveSession(sessionId, userId, REFRESH_TTL_S);

  const base = {
    httpOnly: true,
    sameSite: "lax",
    secure: true,         // set false only when testing on http://localhost
    path: "/",
  };

  res.cookie("mc_token", access,  { ...base, maxAge: ACCESS_TTL_S * 1000 });
  res.cookie("mc_refresh", refresh, { ...base, maxAge: REFRESH_TTL_S * 1000 });
}

function cryptoRandom() {
  // avoid importing node:crypto just for this
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/* ---------------- controllers ---------------- */

/** POST /api/auth/signup */
export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role: "student" });

    await issueSessionCookiesForUser(res, user._id.toString(), req);

    return res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/login */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(400).json({ success: false, message: "Invalid credentials" });

    await issueSessionCookiesForUser(res, user._id.toString(), req);

    return res.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me (requires requireAuth to set req.user) */
export async function me(req, res) {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
  return res.json({ user: req.user });
}

/** POST /api/auth/refresh (uses mc_refresh cookie) */
export async function refresh(req, res) {
  const refreshCookie = req.cookies?.mc_refresh;
  if (!refreshCookie) return res.status(401).json({ success: false, message: "Missing refresh" });

  try {
    const payload = jwt.verify(refreshCookie, JWT_SECRET);
    const { sid, sub } = payload || {};
    if (!sid || !sub) return res.status(401).json({ success: false, message: "Invalid token" });

    const alive = await tokenStore.sessionExists(sid);
    if (!alive) return res.status(401).json({ success: false, message: "Session revoked" });

    // rotate access only (keep same refresh until you want true rotation)
    const access = signAccessToken(sub);

    res.cookie("mc_token", access, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: ACCESS_TTL_S * 1000,
    });

    return res.json({ success: true });
  } catch (_e) {
    return res.status(401).json({ success: false, message: "Invalid refresh" });
  }
}

/** POST /api/auth/logout-everywhere */
export async function logoutEverywhere(req, res) {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });

  // wipe all sessions for this user
  await tokenStore.revokeAllForUser(req.user._id.toString());

  // clear cookies
  res.clearCookie("mc_token",   { path: "/" });
  res.clearCookie("mc_refresh", { path: "/" });

  return res.json({ success: true });
}