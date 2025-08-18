// middleware/validate.js
export function validate(schema) {
  return (req, res, next) => {
    try {
      // Support body, query, params in case you need it later
      const source = req.body ?? {};
      schema.parse(source);
      next();
    } catch (err) {
      const issues = err?.issues?.map(i => `${i.path.join('.')}: ${i.message}`) ?? [];
      res.status(400).json({
        success: false,
        message: 'Invalid request payload',
        errors: issues,
        requestId: req.id,
      });
    }
  };
}
