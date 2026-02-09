const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const ctrl = require("../controllers/progressController.js");

router.get("/ping", ctrl.ping);

// protect everything by default (adjust later if you want public catalogs)
router.use(auth);

router.get("/", ctrl.list);

// common convenience patterns:
router.get("/mine", (req, res) => res.status(501).json({ ok: false, error: "NOT_IMPLEMENTED", action: "mine" }));

router.get("/:id", ctrl.getById);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
