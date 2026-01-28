const dotenv = require("dotenv");
dotenv.config();

const missing = [];

function req(key) {
  const v = process.env[key];
  if (!v || String(v).trim() === "") missing.push(key);
  return v;
}

const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "4000", 10),
  API_BASE: process.env.API_BASE || "/api",

  // Required
  MONGODB_URI: req("MONGODB_URI"),
  JWT_SECRET: req("JWT_SECRET"),

  // Optional
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  EMAIL_FROM: process.env.EMAIL_FROM || "MicroCourse <no-reply@microcourse.local>",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: process.env.SMTP_PORT || "",
  SMTP_SECURE: process.env.SMTP_SECURE || "false",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
};

if (missing.length) {
  const msg =
    "Missing required env vars: " +
    missing.join(", ") +
    "\nCreate a .env file (copy .env.example) and fill values.";
  throw new Error(msg);
}

module.exports = config;
