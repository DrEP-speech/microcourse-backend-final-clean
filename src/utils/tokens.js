"use strict";
const jwt = require("jsonwebtoken");

const ACCESS_TTL  = process.env.ACCESS_TTL  || "15m";
const REFRESH_TTL = process.env.REFRESH_TTL || "7d";

function signAccessToken(user){
  const payload = { sub: String(user._id), role: user.role, email: user.email };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}
function signRefreshToken(user){
  const payload = { sub: String(user._id) };
  return jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}
function verifyAccess(token){ return jwt.verify(token, process.env.JWT_SECRET); }
function verifyRefresh(token){ return jwt.verify(token, process.env.REFRESH_SECRET); }

function setRefreshCookie(res, token){
  const prod = process.env.NODE_ENV === "production";
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? "strict" : "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

module.exports = { signAccessToken, signRefreshToken, verifyAccess, verifyRefresh, setRefreshCookie };
