// middleware/validate.js
export default function validate(validator) {
  return (req, res, next) => {
    try {
      const { value, error } = validator(req.body || {});
      if (error) return res.status(400).json({ success: false, message: error });
      req.body = value; // normalized body
      next();
    } catch (err) {
      next(err);
    }
  };
}
