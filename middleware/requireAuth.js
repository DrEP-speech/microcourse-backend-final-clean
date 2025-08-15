import jwt from "jsonwebtoken";
import User from "../models/User.js";

const { JWT_SECRET = "change-me", COOKIE_NAME = "token" } = process.env;

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: "Unauthenticated" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub).select("_id email");
    if (!user) return res.status(401).json({ success: false, message: "Unauthenticated" });

    req.user = { id: user._id, email: user.email };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthenticated" });
  }
}
