import { ZodError } from 'zod';

export function validate(schema) {
 try { req.body = schema.parse(req.body); next(); }
  catch (e) {
if (e instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: e.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
}
    next(e);
  }
};

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