export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Invalid payload",
        issues,
      });
    }
    req.body = result.data;
    next();
  };
}
export default validate;