// controllers/authController.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const COOKIE_NAME = process.env.COOKIE_NAME || "mc_token";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/** Build a safe user payload (omit password, etc.) */
const toPublicUser = (u) => ({
  _id: u._id,
  email: u.email,
  name: u.name ?? u.displayName ?? "",
  role: u.role ?? "user",
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

/** Sign a JWT */
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** Set the auth cookie with SameSite=None for cross-site usage (Vercel -> Render) */
function setAuthCookie(res, token) {
  // secure cookies required for SameSite=None, and when behind proxies (Vercel/Render)
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,         // must be true on HTTPS (Vercel/Render)
    sameSite: "none",       // allow cross-site requests from your frontend
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
}

/** Clear auth cookie */
function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: "none",
    path: "/",
  });
}

export const signup = async (req, res) => {
  try {
    const { email, password, name = "" } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hash, name });

    const token = signToken(user._id.toString());
    setAuthCookie(res, token);

    return res.status(201).json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = signToken(user._id.toString());
    setAuthCookie(res, token);

    return res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const me = async (req, res) => {
  try {
    // prefer middleware-populated req.user; fallback to decoding cookie
    if (req.user) {
      return res.json({ success: true, user: toPublicUser(req.user) });
    }
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });

    return res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
};

export const logout = async (_req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
};
