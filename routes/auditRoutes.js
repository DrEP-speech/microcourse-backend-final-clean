const express = require("express");
const router = express.Router();

router.get("/flagged", (req, res) => {
  res.status(200).json({ ok: true, items: [] });
});

module.exports = router;