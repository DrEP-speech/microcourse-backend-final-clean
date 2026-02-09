const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const ctrl = require("../controllers/authController");

router.get("/ping", (req, res) => res.json({ ok: true, route: "auth" }));
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/me", requireAuth, ctrl.me);
router.post("/logout", requireAuth, ctrl.logout);

module.exports = router;
