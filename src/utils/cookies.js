function setRefreshCookie(res, token) {
  res.cookie(process.env.COOKIE_NAME || "refresh_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth"
  });
}

module.exports = { setRefreshCookie };
