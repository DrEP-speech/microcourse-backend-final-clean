// middleware/validate.js
function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: parsed.error.format(),
      });
    }
    req.body = parsed.data; // use the parsed/trimmed values
    next();
  };
}
module.exports = { validate };
