import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYAML } from "yaml";
import swaggerUi from "swagger-ui-express";
import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";

// Optional DB connect (if you have it)
let connectDB = null;
try {
  const mod = await import("./config/db.js");
  connectDB = mod?.default || null;
} catch (_) {}

// Routes (ensure these exist)
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
// add other route groups as they exist:
// import badgeRoutes from "./routes/badgeRoutes.js"; etc.

/* ============================ CONFIG ============================ */

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";
const PORT = Number(process.env.PORT || 5000);

const API_PREFIX = process.env.API_PREFIX || "/api";
const API_VERSION = process.env.API_VERSION || ""; // e.g. "v1"
const API_BASE = API_VERSION ? `${API_PREFIX}/${API_VERSION}` : API_PREFIX;

// CORS allow-list (comma separated). Supports wildcards via simple regex.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---- Helpers for wildcard origins ----
function toOriginRegex(pattern) {
  let p = pattern
    .replace(/^https?:\/\//i, "") // strip scheme if present
    .replace(/\./g, "\\.")         // escape dots
    .replace(/\*/g, ".*");         // wildcard
  return new RegExp(`^https?:\\/\\/${p}$`, "i");
}
function matchOrigin(origin, pattern) {
  return toOriginRegex(pattern).test(origin);
}

// CORS options
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // server-to-server / curl
    if (CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes("*")) {
      return cb(null, true);
    }
    const allowed = CORS_ORIGINS.some((pat) => matchOrigin(origin, pat));
    return cb(allowed ? null : new Error(`CORS blocked for: ${origin}`), allowed);
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id", "X-CSRF-Token"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

// Swagger loader
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function loadOpenApiSpec() {
  const yamlPath = path.join(__dirname, "docs", "openapi.yaml");
  if (fs.existsSync(yamlPath)) {
    const raw = fs.readFileSync(yamlPath, "utf8");
    return parseYAML(raw);
  }
  // Minimal fallback so /docs and /openapi.json always work
  return {
    openapi: "3.0.3",
    info: { title: "MicroCourse API", version: "1.0.0" },
    servers: [{ url: API_PREFIX }, API_VERSION ? { url: API_BASE } : null].filter(Boolean),
    paths: {
      "/auth/signup": { post: { summary: "Sign up", responses: { "201": { description: "Created" } } } },
      "/auth/login":  { post: { summary: "Login",  responses: { "200": { description: "OK" } } } },
      "/auth/me":     { get:  { summary: "Me",     responses: { "200": { description: "OK" } } } },
    },
  };
}

/* ============================ APP BOOTSTRAP ============================ */

const app = express();
app.set("trust proxy", 1);

// Basic middleware
app.use(morgan(isProd ? "combined" : "dev"));
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || "1mb" }));
app.use(cookieParser());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ============================ RATE LIMITS ============================ */

// Build a limiter that prefers Redis, falls back to memory
async function makeLimiter({ keyPrefix, points, duration }) {
  try {
    // Try to use shared Redis client if you created config/redis.js
    const redisMod = await import("./config/redis.js").catch(() => null);
    const redis = redisMod?.redis || null;
    if (redis) {
      return new RateLimiterRedis({ storeClient: redis, keyPrefix, points, duration });
    }
  } catch (_) {}
  return new RateLimiterMemory({ keyPrefix, points, duration });
}

const globalLimiterPromise = makeLimiter({
  keyPrefix: "rl:global",
  points: Number(process.env.RL_MAX || (isProd ? 100 : 1000)),
  duration: Number(process.env.RL_WINDOW_SEC || 900), // seconds
});

const loginLimiterPromise = makeLimiter({
  keyPrefix: "rl:login",
  points: Number(process.env.RL_LOGIN_MAX || (isProd ? 10 : 100)),
  duration: Number(process.env.RL_LOGIN_WINDOW_SEC || 600),
});

const limiterMw = (limiterPromise) => async (req, res, next) => {
  try {
    const limiter = await limiterPromise;
    await limiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }
};

// Apply global limiter to API bases
app.use(API_PREFIX, limiterMw(globalLimiterPromise));
if (API_VERSION) app.use(API_BASE, limiterMw(globalLimiterPromise));

/* ============================ HEALTH ============================ */

app.get("/", (_req, res) => res.json({ ok: true, name: "microcourse-backend", env: NODE_ENV }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", (_req, res) => res.json({ ok: true }));

/* ============================ DOCS ============================ */

const openapiSpec = loadOpenApiSpec();
app.get("/openapi.json", (_req, res) => res.json(openapiSpec)); // raw spec
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));

/* ============================ ROUTES ============================ */

function mount(subpath, router, opts = {}) {
  if (!router) return;
  if (opts.loginLimiter) {
    app.use(`${API_PREFIX}${subpath}/login`, limiterMw(loginLimiterPromise));
    if (API_VERSION) app.use(`${API_BASE}${subpath}/login`, limiterMw(loginLimiterPromise));
  }
  app.use(`${API_PREFIX}${subpath}`, router);
  if (API_VERSION) app.use(`${API_BASE}${subpath}`, router);
}

mount("/auth", authRoutes, { loginLimiter: true });
mount("/users", userRoutes);
mount("/notifications", notificationRoutes);
// mount("/badges", badgeRoutes); etc.

/* ============================ 404 + ERROR ============================ */

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, _req, res, _next) => {
  const code = err.status || err.statusCode || 500;
  const payload = { success: false, message: err.message || "Server Error" };
  if (!isProd && err.stack) payload.stack = err.stack;
  res.status(code).json(payload);
});

/* ============================ START ============================ */

(async () => {
  try {
    if (typeof connectDB === "function") {
      await connectDB();
    }
    app.listen(PORT, () => {
      if (CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes("*")) {
        console.log("CORS: allowing all origins");
      } else {
        console.log(`CORS: allowed origins -> ${CORS_ORIGINS.join(", ")}`);
      }
      console.log(`✅ Server listening on :${PORT} (${NODE_ENV})`);
    });
  } catch (e) {
    console.error("❌ Failed to start server:", e);
    process.exit(1);
  }
})();