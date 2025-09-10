/**
 * Minimal auth gate. Replace with your real session/jwt check later.
 */
export function requireAuth(req, res, next) {
  return next();
}
export default requireAuth;
