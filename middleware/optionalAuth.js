/**
 * Optional auth: if your project already has requireAuth middleware, we try to use it.
 * If not available, requests proceed unauthenticated (still works for local testing).
 */
module.exports = function optionalAuth(req, res, next) {
  try {
    // Attempt common middleware filenames
    const candidates = [
      "../middleware/requireAuth",
      "../middleware/authMiddleware",
      "../middleware/requireAuthMiddleware",
      "../middleware/protect",
    ];

    for (const rel of candidates) {
      try {
        const mw = require(rel);
        if (typeof mw === "function") {
          return mw(req, res, next);
        }
        if (mw && typeof mw.requireAuth === "function") {
          return mw.requireAuth(req, res, next);
        }
      } catch (_) {}
    }

    return next();
  } catch (_) {
    return next();
  }
};
