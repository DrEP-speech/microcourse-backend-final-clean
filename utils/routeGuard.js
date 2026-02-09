"use strict";

function notImpl(label, methodName) {
  return (req, res) => {
    res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED",
      route: label,
      handler: methodName
    });
  };
}

/**
 * ensureFns(label, controller, requiredMethods[])
 * Returns a controller object where each required method is guaranteed to be a function.
 */
function ensureFns(label, controller, required = []) {
  const obj = controller && typeof controller === "object" ? controller : {};
  for (const name of required) {
    if (typeof obj[name] !== "function") obj[name] = notImpl(label, name);
  }
  return obj;
}

/**
 * ensureRouter(router, label)
 * Defensive check that a file exported an Express Router.
 */
function ensureRouter(router, label) {
  const ok =
    router &&
    typeof router === "function" &&
    typeof router.use === "function" &&
    typeof router.route === "function";

  if (!ok) {
    const err = new Error(`[ROUTE_GUARD] ${label} did not export an Express Router`);
    err.code = "ROUTE_GUARD_INVALID_ROUTER";
    throw err;
  }
  return router;
}

module.exports = { ensureFns, ensureRouter };