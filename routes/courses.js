const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const course = require("../controllers/courseController");

router.get("/public", course.listPublic);
router.get("/", requireAuth, course.list);

module.exports = router;