const express = require("express");
const router = express.Router();

const { attachUser, requireAuth, requireRole } = require("../middleware/auth");
const courseController = require("../controllers/courseController");

router.use(attachUser);

router.get("/", requireAuth, courseController.listCourses);
router.post("/", requireAuth, requireRole("admin", "instructor"), courseController.createCourse);

module.exports = router;