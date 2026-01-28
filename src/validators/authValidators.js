const { body, validationResult } = require("express-validator");

const loginRules = [
  body("email").optional().isEmail().withMessage("email must be a valid email"),
  body("userEmail").optional().isEmail().withMessage("userEmail must be a valid email"),
  body("password").isString().isLength({ min: 6 }).withMessage("password must be at least 6 chars"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, error: errors.array()[0].msg, details: errors.array() });
    }
    req.body.email = req.body.email || req.body.userEmail;
    return next();
  },
];

module.exports = { loginRules };
