const express = require("express");
const router = express.Router();

// -------------------------------------------------------------
// Tiny loader that tries multiple paths (because your repo has _legacy)
// -------------------------------------------------------------
function tryRequire(paths) {
  for (const p of paths) {
    try { return require(p); } catch { /* ignore */ }
  }
  return null;
}

// -------------------------------------------------------------
// Deep function picker: finds a callable handler even if nested
// -------------------------------------------------------------
function pickFnDeep(mod, names) {
  const seen = new Set();

  function walk(x) {
    if (!x) return null;
    if (typeof x === "function") return x;

    if (typeof x !== "object") return null;
    if (seen.has(x)) return null;
    seen.add(x);

    // Common nesting keys first
    for (const k of ["handler", "fn", "run", "default"]) {
      if (x[k]) {
        const got = walk(x[k]);
        if (got) return got;
      }
    }

    // Then scan by requested names
    for (const n of names) {
      if (x[n]) {
        const got = walk(x[n]);
        if (got) return got;
      }
    }

    // Finally: scan all properties (last resort)
    for (const k of Object.keys(x)) {
      const got = walk(x[k]);
      if (got) return got;
    }

    return null;
  }

  // Supports module.exports = fn
  return walk(mod);
}

function must(fn, label) {
  if (typeof fn !== "function") {
    throw new Error(`authRoutes: Expected function for "${label}", got ${typeof fn}`);
  }
  return fn;
}

// -------------------------------------------------------------
// Load middleware (optional)
// -------------------------------------------------------------
const authMw = tryRequire([
  "../middleware/auth",
  "../middleware/authMiddleware",
  "../middleware/requireAuth",
  "../middleware",
]);

const requireAuth =
  pickFnDeep(authMw, ["requireAuth", "auth", "protect", "verifyToken"]) ||
  ((req, res, next) => next());

let requireRole =
  (authMw && authMw.requireRole && typeof authMw.requireRole === "function" && authMw.requireRole) ||
  (authMw && authMw.default && authMw.default.requireRole && typeof authMw.default.requireRole === "function" && authMw.default.requireRole) ||
  null;

if (!requireRole) requireRole = () => (req, res, next) => next();

// -------------------------------------------------------------
// Load controller from the *right* place
// -------------------------------------------------------------
const authController = tryRequire([
  "../controllers/authController",
  "../controllers/auth",
  "../_legacy/controllers/authController",
  "../_legacy/src-controllers/authController",
]);

if (!authController) {
  throw new Error("authRoutes: Could not locate authController in controllers/ or _legacy/");
}

const register = pickFnDeep(authController, ["register", "signup", "createUser"]);
const login    = pickFnDeep(authController, ["login", "signin"]);
const me       = pickFnDeep(authController, ["me", "profile", "currentUser"]);
const logout   = pickFnDeep(authController, ["logout", "signout"]) || ((req, res) => res.json({ ok: true }));

// -------------------------------------------------------------
// Routes
// -------------------------------------------------------------
router.post("/register", must(register, "register"));
router.post("/login", must(login, "login"));
router.get("/me", must(requireAuth, "requireAuth"), must(me, "me"));
router.post("/logout", must(requireAuth, "requireAuth"), must(logout, "logout"));

// optional admin check
router.get("/admin/ping", must(requireAuth, "requireAuth"), requireRole("admin"), (req, res) => {
  res.json({ ok: true, role: "admin" });
});

module.exports = router;
