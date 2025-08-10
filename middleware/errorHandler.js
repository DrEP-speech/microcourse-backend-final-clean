// middleware/errorHandler.js

// Helper to build standardized JSON payloads
const buildErrorBody = (err) => {
  const body = {
    success: false,
    message: err?.message || 'Internal Server Error',
  };
  if (err?.code) body.code = err.code;          // optional app-specific error code
  if (err?.details) body.details = err.details; // optional structured details
  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    body.stack = err.stack;
  }
  return body;
};

// 404 “route not found” handler
export const notFound = (req, _res, next) => {
  const err = new Error(`Route ${req.method} ${req.originalUrl} not found`);
  err.status = 404;
  next(err);
};

// Central error handler — last middleware
export const errorHandler = (err, _req, res, _next) => {
  const status = Number(err?.status) || 500;
  res.status(status).json(buildErrorBody(err));
};
