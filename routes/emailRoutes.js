const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({ ok: true, message: "email route stub" });
});

module.exports = router;