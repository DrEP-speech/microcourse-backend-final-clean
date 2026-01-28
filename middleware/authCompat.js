const jwt = require("jsonwebtoken");

function getToken(req) {
  // Cookie token (auth-cookie flow)
  const cookieToken = req.cookies && (req.cookies.token || req.cookies.jwt || req.cookies.access_token);
  if (cookieToken) return cookieToken;

  // Bearer token (auth flow)
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  return null;
}

function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);

    // Normalize user object
    req.user = decoded.user || decoded;
    if (!req.user || !req.user.id && !req.user._id) {
      // some tokens store userId
      req.user = { id: decoded.userId || decoded.id || decoded._id };
    }

    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token", error: err.message });
  }
}

module.exports = { requireAuth };
