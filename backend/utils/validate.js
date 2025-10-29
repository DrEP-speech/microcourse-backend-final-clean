const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

// Ajv configured for 2020-12
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  strict: false, // relaxed while we iterate
});

addFormats(ajv);

function validate(schema) {
  const v = ajv.compile(schema);
  return (req, res, next) => {
    const ok = v(req.body);
    if (!ok) {
      return res.status(400).json({ success: false, errors: v.errors });
    }
    next();
  };
}

module.exports = validate;
