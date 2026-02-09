const express = require("express");
const router = express.Router();

const {
  listCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
} = require("../controllers/courseController");

// Sanity route
router.get("/ping", (req, res) => res.json({ ok: true, route: "courses" }));

// Public
router.get("/", listCourses);
router.get("/:id", getCourseById);

// Admin/Instructor (auth can be inserted later)
router.post("/", createCourse);
router.put("/:id", updateCourse);
router.delete("/:id", deleteCourse);

module.exports = router;