// utils/requireFresh.js
"use strict";

/**
 * requireFresh(modulePath)
 * - Forces Node to reload a module (bypasses require cache).
 * - Use in dev if you suspect cache weirdness.
 */
function requireFresh(modulePath) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  return require(resolved);
}

module.exports = { requireFresh };
