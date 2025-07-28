import authMiddleware from "../middleware/authMiddleware.js";

// Protected profile route
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    res.status(200).json({
      message: "Profile fetched successfully",
      user: req.user, // decoded user info from token
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

import jwt from "jsonwebtoken";

// Middleware to check token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded payload to request
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ===== GET Profile (Protected) =====
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    // Optionally, fetch user info from DB using req.user.id
    res.status(200).json({
      message: "Profile fetched successfully",
      user: req.user,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
