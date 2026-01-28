const { HttpError } = require("../utils/httpError");

function validate(schema) {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(new HttpError(400, "Validation failed", error.details.map((d) => d.message)));
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
