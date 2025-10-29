const express = require("express");
const router = express.Router();

router.use("/health", require("./health"));
router.use("/auth", require("./auth"));
router.use("/courses", require("./courses"));
router.use("/quizzes", require("./quizzes"));
router.use("/results", require("./results"));
router.use("/notifications", require("./notifications"));
router.use("/email", require("./email"));
router.use("/parent", require("./parent"));
router.use("/sessions", require("./sessions"));
router.use("/admin", require("./admin"));

module.exports = router;
