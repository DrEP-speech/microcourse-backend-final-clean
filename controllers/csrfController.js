// controllers/csrfController.js
import { randomUUID } from 'node:crypto';

const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME || 'mc_csrf';

export function issueCsrf(req, res) {
  const token = randomUUID();

  // Pick a base path that covers all your API routes mounted at /api
  const cookiePath = process.env.API_PREFIX || '/api';

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: true,         // not readable by JS
    sameSite: 'lax',        // works for same-site POSTs (Swagger/PowerShell are fine)
    secure: req.secure || (req.headers['x-forwarded-proto'] === 'https'),
    path: cookiePath,       // <-- IMPORTANT: covers /api/auth/*
    maxAge: 60 * 60 * 1000  // 1 hour
  });

  // Also return it in the body so scripts/Swagger can grab it easily
  return res.status(200).json({ csrfToken: token });
}
