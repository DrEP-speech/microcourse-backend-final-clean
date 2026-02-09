const { ensureFns, ensureRouter, makeHandler } = require("../utils/routeGuard");
"use strict";

const express = require("express");
const router = express.Router();
// Optional controller load. If missing, handlers become 501 stubs (unless ROUTE_GUARD_STRICT=1).
let controller = {};
try {
  controller = require("../controllers/notificationsController");
} catch (e) {
  controller = {};
}

// You can add required handler names later; for now we keep boot-safe sanity.
controller = ensureFns("notificationsController", controller, []);

router.get("/ping", (req, res) => res.json({ ok: true, route: "notifications" }));

module.exports = router;