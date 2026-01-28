const express = require("express");
const router = express.Router();

router.get("/", async (_req, res) => {
  res.json({ success: true, data: [] });
});

router.post("/", async (req, res) => {
  res.status(201).json({ success: true, data: req.body || {} });
});

module.exports = router;
