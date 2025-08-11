// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE_NAME = process.env.COOKIE_NAME || "mc_token";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
}
