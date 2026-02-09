"use strict";

/**
 * Uniform stub factory.
 * Any missing controller export gets this so Express never crashes.
 */
exports.stub = (name) => async (req, res) => {
  return res.status(501).json({
    ok: false,
    error: "NOT_IMPLEMENTED",
    handler: name,
    todo: `Implement ${name}`
  });
};