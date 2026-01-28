function notFound(req, res, next) {
  res.status(404).json({ ok: false, error: "NOT_FOUND", detail: `No route: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const msg = err.message || String(err);
  res.status(status).json({ ok: false, error: "SERVER_ERROR", detail: msg });
}

module.exports = { notFound, errorHandler };
