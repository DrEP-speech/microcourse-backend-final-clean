const router = require("express").Router();
const { listCourses, createCourse, getCourseById } = require("../controllers/courseController");
const { authRequired, requireRole } = require("../middleware/auth");

router.get("/", listCourses);

// Fetch single course by id (needed for E2E)
router.get("/:id", require("./../middleware/auth").optionalAuth || ((req,res,next)=>next()), async (req,res,next) => {
  try {
    const { id } = req.params;
    const Course = require("../models/Course");
    const course = await Course.findById(id).lean();
    if (!course) return res.status(404).json({ message: "Course not found" });
    return res.json(course);
  } catch (e) { return next(e); }
});
// Instructor/Admin can create courses
router.post("/", authRequired, requireRole("instructor", "admin"), createCourse);

module.exports = router;


