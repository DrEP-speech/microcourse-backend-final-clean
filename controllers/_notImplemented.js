function notImplemented(name) {
  return function(req, res) {
    res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED",
      handler: name,
      method: req.method,
      path: req.originalUrl || req.url
    });
  };
}

module.exports = { notImplemented };