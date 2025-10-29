const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

// Strict + all errors; reject unknown props (but allow union types)
const ajv = new Ajv({
  strict: true,
  allErrors: true,
  allowUnionTypes: true,
  removeAdditional: "failing"
});
addFormats(ajv);

// compile&cache validators by schema name (backend/schemas/<name>.json)
const cache = new Map();
function validatorFor(schemaName) {
  if (cache.has(schemaName)) return cache.get(schemaName);
  const schemaPath = path.join(__dirname, "..", "schemas", `${schemaName}.json`);
  const raw = fs.readFileSync(schemaPath, "utf8");
  const schema = JSON.parse(raw);
  const validateFn = ajv.compile(schema);
  cache.set(schemaName, validateFn);
  return validateFn;
}

module.exports = function validate(schemaName) {
  return (req, res, next) => {
    try {
      const fn = validatorFor(schemaName);
      if (fn(req.body)) return next();
      const errors = (fn.errors || []).map(e => ({
        path: e.instancePath || e.schemaPath,
        keyword: e.keyword,
        message: e.message,
        params: e.params
      }));
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    } catch (err) { next(err); }
  };
};

module.exports.ajv = ajv;
module.exports.validatorFor = validatorFor;
