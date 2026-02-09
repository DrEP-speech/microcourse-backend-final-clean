/**
 * Central cookie policy.
 * - dev: secure=false so http://localhost works
 * - prod: secure=true for https
 */
const isProd = process.env.NODE_ENV === "production";

module.exports = {
  accessToken: {
    name: "access_token",
    options: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 1000 * 60 * 15
    }
  },

  refreshToken: {
    name: "refresh_token",
    options: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  },

  clearOptions: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/"
  }
};