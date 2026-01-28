const express = require("express");
const router = express.Router();

// ---------- helpers ----------
function tryRequire(paths) {
  for (const p of paths) {
    try { return require(p); } catch {}
  }
  return null;
}

function pickFnDeep(mod, names) {
  const seen = new Set();
  function walk(x) {
    if (!x) return null;
    if (typeof x === "function") return x;
    if (typeof x !== "object") return null;
    if (seen.has(x)) return null;
    seen.add(x);

    for (const k of ["handler", "fn", "run", "default"]) {
      if (x[k]) {
        const got = walk(x[k]);
        if (got) return got;
      }
    }

    for (const n of names) {
      if (x[n]) {
        const got = walk(x[n]);
        if (got) return got;
      }
    }

    for (const k of Object.keys(x)) {
      const got = walk(x[k]);
      if (got) return got;
    }
    return null;
  }
  return walk(mod);
}

function must(fn, label) {
  if (typeof fn !== "function") {
    throw new Error(`courseRoutes: Expected function for "${label}", got ${typeof fn}`);
  }
  return fn;
}

// ---------- middleware (optional) ----------
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

// ---------- controller loader ----------
const courseController = tryRequire([
  "../controllers/courseController",
  "../controllers/course",
  "../_legacy/controllers/courseController",
  "../_legacy/src-controllers/courseController",
]);

if (!courseController) {
  throw new Error("courseRoutes: Could not locate courseController in controllers/ or _legacy/");
}

// ---------- handlers (map many naming variants) ----------
const listCourses   = pickFnDeep(courseController, ["listCourses", "getCourses", "getAllCourses", "index"]);
const getCourse     = pickFnDeep(courseController, ["getCourse", "getById", "read", "show"]);
const createCourse  = pickFnDeep(courseController, ["createCourse", "create", "addCourse", "post"]);
const updateCourse  = pickFnDeep(courseController, ["updateCourse", "update", "put"]);
const deleteCourse  = pickFnDeep(courseController, ["deleteCourse", "removeCourse", "delete", "destroy"]);

// ---------- routes ----------
router.get("/", must(listCourses || ((req,res)=>res.json([])), "listCourses"));
router.get("/:courseId", must(getCourse || ((req,res)=>res.status(404).json({ok:false,error:"Not implemented"})), "getCourse"));

// write ops: protect + role if you want
router.post("/", must(requireAuth, "requireAuth"), requireRole("instructor"), must(createCourse || ((req,res)=>res.status(501).json({ok:false,error:"Not implemented"})), "createCourse"));
router.put("/:courseId", must(requireAuth, "requireAuth"), requireRole("instructor"), must(updateCourse || ((req,res)=>res.status(501).json({ok:false,error:"Not implemented"})), "updateCourse"));
router.delete("/:courseId", must(requireAuth, "requireAuth"), requireRole("instructor"), must(deleteCourse || ((req,res)=>res.status(501).json({ok:false,error:"Not implemented"})), "deleteCourse"));

module.exports = router;
