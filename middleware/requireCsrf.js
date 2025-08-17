import crypto from "crypto";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const isProd = (process.env.NODE_ENV || "development") === "production";

export function issueCsrf(req, res) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || typeof token !== "string" || token.length < 32) {
    token = crypto.randomBytes(32).toString("base64url");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000,
    });
  }
  return res.json({ csrfToken: token });
}

export function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken =
    req.get(CSRF_HEADER) ||
    req.get("X-CSRF-Token") ||
    (typeof req.body?.csrfToken === "string" ? req.body.csrfToken : null);

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ success: false, message: "CSRF token missing" });
  }

  try {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("mismatch");
    }
    return next();
  } catch {
    return res.status(403).json({ success: false, message: "CSRF token invalid" });
  }
}