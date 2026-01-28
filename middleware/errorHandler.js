module.exports = function errorHandler(err, req, res, next) {
  console.error("[error]", err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? "Server error" : "Request error",
    message: err?.message || String(err),
    path: req.originalUrl,
  });
};
