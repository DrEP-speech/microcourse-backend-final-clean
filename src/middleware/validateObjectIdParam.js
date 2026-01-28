const mongoose = require("mongoose");

module.exports = (paramName) => (req, res, next) => {
  const v = req.params[paramName];
  if (!mongoose.isValidObjectId(v)) {
    return res.status(400).json({ ok: false, error: `Invalid ${paramName}` });
  }
  next();
};
