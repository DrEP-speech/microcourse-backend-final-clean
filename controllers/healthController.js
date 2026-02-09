'use strict';

function notImplemented(name) {
  return async (req, res) => {
    return res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED",
      handler: name,
      method: req.method,
      path: req.originalUrl
    });
  };
}
async function health(req, res) {
  return res.json({
    ok: true,
    service: "microcourse-backend",
    time: new Date().toISOString(),
  });
}

module.exports = { health,
  health: notImplemented("health"),
 };
