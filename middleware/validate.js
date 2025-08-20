// middleware/validate.js
import { ZodError } from 'zod';

export default function validate(schema) {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req.body ?? {});
      req.body = parsed; // use sanitized body
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          success: false,
          message: 'Invalid request',
          errors: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      next(err);
    }
  };
}
