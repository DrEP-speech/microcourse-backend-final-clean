/**
 * Double-submit CSRF:
 * - For unsafe methods (POST, PUT, PATCH, DELETE), require:
 *   header (x-csrf-token || x-xsrf-token || body._csrf) === cookie XSRF-TOKEN
 * - Optional strict origin check with CSRF_STRICT_ORIGIN=true
 */
export function requireCsrf(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const hdr =
    req.get("x-csrf-token") ||
    req.get("x-xsrf-token") ||
    (req.body && req.body._csrf);

  const cookie =
    (req.cookies && (req.cookies["XSRF-TOKEN"] || req.cookies["xsrf-token"] || req.cookies["XSRF_TOKEN"])) ||
    null;

  if (!hdr || !cookie || hdr !== cookie) {
    return res.status(403).json({ success: false, message: "Invalid or missing CSRF token" });
  }

  // Optional strict origin check
  const strict = String(process.env.CSRF_STRICT_ORIGIN || "").toLowerCase() === "true";
  if (strict) {
    const host = (req.headers && req.headers.host) ? (req.secure ? `https://${req.headers.host}` : `http://${req.headers.host}`) : "";
    const origin = req.get("origin") || "";
    const referer = req.get("referer") || "";

    const goodOrigin = origin && origin.toLowerCase().startsWith(host.toLowerCase());
    const goodReferer = referer && referer.toLowerCase().startsWith(host.toLowerCase());

    if (!goodOrigin && !goodReferer) {
      return res.status(403).json({ success: false, message: "Bad origin/referer" });
    }
  }

  return next();
}
