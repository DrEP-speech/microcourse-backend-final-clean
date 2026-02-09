const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const authController = require("../controllers/authController");

// Public
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected
router.get("/me", requireAuth, authController.me);

module.exports = router;