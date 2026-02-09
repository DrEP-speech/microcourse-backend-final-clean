const express = require("express");
const router = express.Router();

// NOTE: keep your existing mounts; add these if missing
try { router.use("/courses", require("./courseRoutes")); } catch (e) {}
try { router.use("/quizzes", require("./quizRoutes")); } catch (e) {}
try { router.use("/results", require("./resultsRoutes")); } catch (e) {}
try { router.use("/insights", require("./insightsRoutes")); } catch (e) {}

module.exports = router;
