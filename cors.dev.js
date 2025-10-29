const express = require("express");
const cors = require("cors");

const app = express();

const DEV = process.env.NODE_ENV !== "production";
const VITE_PORTS = ["5173","5174","5175","5176","5177"];

// Build an allow list (include any extra origins via ADMIN_ORIGIN env, comma-separated)
const allowList = [
  ...VITE_PORTS.map(p => `http://localhost:${p}`),
  ...VITE_PORTS.map(p => `http://127.0.0.1:${p}`),
  process.env.ADMIN_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // allow Postman/curl (no origin) and dev localhost vite ports
    if (!origin) return cb(null, true);
    if (DEV && /^http:\/\/(localhost|127\.0\.0\.1):51(7|8)\d$/.test(origin)) return cb(null, true);
    if (allowList.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true,
};

// CORS first
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// the rest of your server.js content follows…
module.exports = { app, corsOptions };
