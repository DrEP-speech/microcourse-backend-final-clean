// ESM
export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role; // set by requireAuth
    if (!role || (allowed.length && !allowed.includes(role))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
}
