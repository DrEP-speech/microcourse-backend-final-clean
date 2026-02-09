/**
 * Alias route file.
 * Some codebases import routes/auth.js, others import routes/authRoutes.js.
 * This keeps both working, with authRoutes.js as the single source of truth.
 */
module.exports = require("./authRoutes");