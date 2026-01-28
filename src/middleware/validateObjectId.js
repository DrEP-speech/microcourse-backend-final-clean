const mongoose = require("mongoose");

function validateObjectIdParam(paramName) {
  return (req, res, next) => {
    const val = req.params?.[paramName];
    if (!mongoose.Types.ObjectId.isValid(val)) {
      return res.status(400).json({ ok: false, error: `Invalid ObjectId for ${paramName}` });
    }
    next();
  };
}

module.exports = { validateObjectIdParam };
