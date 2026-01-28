const jwt = require("jsonwebtoken");

function mustGet(name, fallbackName) {
  const v = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!v) throw new Error(`Missing ${name}${fallbackName ? " (or " + fallbackName + ")" : ""} in environment`);
  return v;
}

function getAccessSecret() {
  return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || mustGet("JWT_ACCESS_SECRET", "JWT_SECRET");
}
function getRefreshSecret() {
  return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || mustGet("JWT_REFRESH_SECRET", "JWT_SECRET");
}
function getAccessTtl() {
  return process.env.JWT_ACCESS_EXPIRES_IN || "15m";
}
function getRefreshTtl() {
  return process.env.JWT_REFRESH_EXPIRES_IN || "7d";
}

function signAccessToken(payload, options = {}) {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: getAccessTtl(), ...options });
}

function signRefreshToken(payload, options = {}) {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: getRefreshTtl(), ...options });
}

function verifyAccessToken(token) {
  return jwt.verify(token, getAccessSecret());
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getRefreshSecret());
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
