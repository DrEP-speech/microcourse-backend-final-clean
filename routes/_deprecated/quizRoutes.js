/**
 * routes/quizRoutes.js
 * Compatibility shim: exports the same router as routes/quizzes.js
 * Prevents duplicate logic + prevents undefined handlers.
 */
module.exports = require("./quizzes");