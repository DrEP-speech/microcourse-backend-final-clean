const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({ ok: true, message: "notifications route stub" });
});

module.exports = router;