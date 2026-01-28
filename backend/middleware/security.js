const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");

module.exports = function security() {
  const isProd = process.env.NODE_ENV === "production";
  const allow = (process.env.CORS_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const corsOptions = allow.length
    ? {
        origin(origin, cb) {
          if (!origin || allow.includes(origin)) return cb(null, true);
          cb(new Error("Not allowed by CORS"));
        },
        credentials: true,
      }
    : { origin: true, credentials: true }; // permissive for local/dev

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
  });

  return [
    helmet({ contentSecurityPolicy: isProd ? undefined : false }),
    compression(),
    cors(corsOptions),
    mongoSanitize(),
    xss(),
    hpp(),
    limiter,
  ];
};
