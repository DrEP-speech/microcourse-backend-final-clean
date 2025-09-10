import { randomUUID } from "node:crypto";

export function issueCsrf(req, res) {
  const token = randomUUID();

  const secure = String(process.env.SESSION_COOKIE_SECURE).toLowerCase() === 'true';
  const domain = process.env.COOKIE_DOMAIN || undefined;

  // Client-readable CSRF cookie (double-submit pattern)
  res.cookie("XSRF-TOKEN", token, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    domain,
    path: "/",
    maxAge: 1000 * 60 * 60 // 1h
  });

  return res.status(200).json({ csrfToken: token });
}
