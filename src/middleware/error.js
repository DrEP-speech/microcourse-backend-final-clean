/* eslint-disable no-unused-vars */
const { HttpError } = require("../utils/httpError");

function notFoundHandler(req, res, next) {
  res.status(404).json({ ok: false, error: "Not Found", path: req.originalUrl });
}

function errorHandler(err, req, res, next) {
  const status = err instanceof HttpError ? err.status : 500;
  const payload = {
    ok: false,
    error: err?.message || "Server Error"
  };
  if (err instanceof HttpError && err.details) payload.details = err.details;
  res.status(status).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
