const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { register, login, me } = require("../controllers/authController");

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/me
router.get("/me", requireAuth, me);

module.exports = router;