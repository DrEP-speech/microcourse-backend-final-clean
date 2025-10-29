class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// wrap async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { AppError, asyncHandler };
