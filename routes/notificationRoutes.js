const express = require("express");
const router = express.Router();

router.all("*", (req, res) => {
  res.status(501).json({
    ok: false,
    error: "Not implemented",
    route: req.originalUrl,
  });
});

module.exports = router;