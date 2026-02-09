const router = require("express").Router();
const lc = require("../controllers/lessonController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/", requireAuth, lc.listLessons);
router.post("/", requireAuth, lc.createLesson);

module.exports = router;
