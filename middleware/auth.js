// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE_NAME = process.env.COOKIE_NAME || "mc_token";
const JWT_SECRET  = process.env.JWT_SECRET  || "change-me";

// Require a valid auth cookie; attaches full user doc to req.user
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const payload = jwt.verify(token, JWT_SECRET); // e.g. { sub: userId }
    const user = await User.findById(payload.sub).lean();
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// Optional role guard for admin/mod endpoints
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
};
