/**
 * CommonJS roles middleware (fixes: "allowRoles is not a function" and missing named exports).
 */
function allowRoles() {
  var roles = Array.prototype.slice.call(arguments);

  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    var role = req.user.role;
    if (roles.length === 0 || roles.indexOf(role) !== -1) {
      return next();
    }

    return res.status(403).json({ success: false, message: "Forbidden" });
  };
}

// Alias names some route files may be importing
var requireRole = allowRoles;
var requireAnyRole = allowRoles;

module.exports = {
  allowRoles,
  requireRole,
  requireAnyRole,
};
