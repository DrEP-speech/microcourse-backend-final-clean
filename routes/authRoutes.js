const express = require("express");
const router = express.Router();

const rawAuthController = require("../controllers/authController");
const { pickFirstFunction, must } = require("../lib/routerUtils");

// Pick functions safely regardless of module export shape
const register = must(pickFirstFunction("register", rawAuthController), "register", rawAuthController);
const login    = must(pickFirstFunction("login", rawAuthController), "login", rawAuthController);
const me       = must(pickFirstFunction("me", rawAuthController), "me", rawAuthController);
const logout   = must(pickFirstFunction("logout", rawAuthController), "logout", rawAuthController);

// Sanity route
router.get("/ping", (req, res) => res.json({ ok: true, route: "auth" }));

router.post("/register", register);
router.post("/login", login);
router.get("/me", me);
router.post("/logout", logout);

module.exports = router;