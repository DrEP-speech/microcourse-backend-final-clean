// server.js  — Node 20+, ESM

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYAML } from 'yaml';
import { v4 as uuidv4 } from 'uuid';

// ---- If you have DB connect helper, keep this import ----
import connectDB from './config/db.js';

// ---- Your route groups (ensure these files exist) ----
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import badgeRoutes from './routes/badgeRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import lessonRoutes from './routes/lessonRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import quizResultRoutes from './routes/quizResultRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
// import analyticsRoutes from './routes/analyticsRoutes.js'; // add if/when present

/* ============================ CONFIG ============================ */

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 5000);

// Base prefixes:  /api  and optionally /api/v1
const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || ''; // set to 'v1' to enable versioned alias
const API_BASE = API_VERSION ? `${API_PREFIX}/${API_VERSION}` : API_PREFIX;

// CORS allow-list (comma-sep). Supports wildcards like https://*.your-domain.com
// Examples: "https://app.your-domain.com,https://*.your-domain.com,http://localhost:3000"
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Helper to match origins with simple wildcard support
const toOriginRegex = (pattern) => {
  // allow http or https
  let p = pattern
    .replace(/^https?:\/\//, '')       // strip scheme
    .replace(/\./g, '\\.')             // escape dots
    .replace(/\*/g, '.*');             // wildcard
  return new RegExp(`^https?:\\/\\/${p}$`, 'i');
};
const matchOrigin = (origin, pattern) => toOriginRegex(pattern).test(origin);

// CORS options
const corsOptions = {
  origin(origin, cb) {
    // allow same-origin / server-to-server / curl(no origin)
    if (!origin) return cb(null, true);

    // allow everything if list is empty or contains "*"
    if (CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes('*')) {
      return cb(null, true);
    }

    const allowed = CORS_ORIGINS.some((pat) => matchOrigin(origin, pat));
    cb(allowed ? null : new Error(`CORS blocked for: ${origin}`), allowed);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

// Swagger loader (prefers docs/openapi.yaml if present)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function loadOpenApiSpec() {
  const yamlPath = path.join(__dirname, 'docs', 'openapi.yaml');
  if (fs.existsSync(yamlPath)) {
    const raw = fs.readFileSync(yamlPath, 'utf8');
    return parseYAML(raw);
  }
  // Minimal fallback spec so /docs always works
  return {
    openapi: '3.0.3',
    info: { title: 'MicroCourse API', version: '1.0.0' },
    servers: [{ url: API_PREFIX }, API_VERSION ? { url: API_BASE } : null].filter(Boolean),
    paths: {
      '/auth/login': { post: { summary: 'Login', responses: { '200': { description: 'OK' } } } },
      '/auth/signup': { post: { summary: 'Sign up', responses: { '201': { description: 'Created' } } } },
      '/auth/me': { get: { summary: 'Current user', responses: { '200': { description: 'OK' } } } },
    },
  };
}

/* ============================ APP BOOTSTRAP ============================ */

const app = express();

// Needed for secure cookies behind Render/other proxies
app.set('trust proxy', 1);

// Request ID for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Logging
app.use(morgan(isProd ? 'combined' : 'dev'));

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// Compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || '1mb' }));
app.use(cookieParser());

// CORS + preflight
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ============================ RATE LIMITS ============================ */

// Global limiter for everything under /api
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RL_WINDOW_MS || 15 * 60 * 1000), // 15m
  max: Number(process.env.RL_MAX || (isProd ? 100 : 1000)),
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for /auth/login
const authLoginLimiter = rateLimit({
  windowMs: Number(process.env.RL_LOGIN_WINDOW_MS || 10 * 60 * 1000), // 10m
  max: Number(process.env.RL_LOGIN_MAX || (isProd ? 10 : 100)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

// Apply global limiter to API bases
app.use(API_PREFIX, apiLimiter);
if (API_VERSION) app.use(API_BASE, apiLimiter);

/* ============================ HEALTH / ROOT ============================ */

app.get('/', (_req, res) =>
  res.json({ ok: true, name: 'microcourse-backend', env: NODE_ENV }),
);
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => {
  // If you use mongoose, you can check readiness here
  // const up = mongoose.connection.readyState === 1;
  const up = true;
  res.status(up ? 200 : 503).json({ ok: up });
});

/* ============================ DOCS (Swagger) ============================ */

const openapiSpec = loadOpenApiSpec();
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));

/* ============================ ROUTES ============================ */

// NOTE: we mount BOTH unversioned (/api) and versioned (/api/v1) aliases.
const mount = (subpath, router) => {
  if (!router) return;
  // Per-route limiter example
  if (subpath === '/auth') {
    app.use(`${API_PREFIX}${subpath}/login`, authLoginLimiter);
    if (API_VERSION) app.use(`${API_BASE}${subpath}/login`, authLoginLimiter);
  }
  app.use(`${API_PREFIX}${subpath}`, router);
  if (API_VERSION) app.use(`${API_BASE}${subpath}`, router);
};

mount('/auth', authRoutes);
mount('/users', userRoutes);
mount('/badges', badgeRoutes);
mount('/courses', courseRoutes);
mount('/lessons', lessonRoutes);
mount('/quizzes', quizRoutes);
mount('/quiz-results', quizResultRoutes);
mount('/notifications', notificationRoutes);
mount('/emails', emailRoutes);
mount('/pdf', pdfRoutes);
mount('/insights', insightsRoutes);
// mount('/analytics', analyticsRoutes);

/* ============================ 404 + ERROR ============================ */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.id,
  });
});

// Central error handler
// (Make sure this is the last middleware)
app.use((err, _req, res, _next) => {
  const code = err.status || err.statusCode || 500;
  const payload = {
    success: false,
    message: err.message || 'Server Error',
    requestId: _req?.id,
  };
  if (!isProd && err.stack) payload.stack = err.stack;
  res.status(code).json(payload);
});

/* ============================ START ============================ */

(async () => {
  try {
    // connect DB if you have one
    if (typeof connectDB === 'function') {
      await connectDB();
    }
    app.listen(PORT, () => {
      if (CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes('*')) {
        console.log(`CORS: allowing all origins`);
      } else {
        console.log(`CORS: allowed origins -> ${CORS_ORIGINS.join(', ')}`);
      }
      console.log(`✅ Server listening on :${PORT} (${NODE_ENV})`);
    });
  } catch (e) {
    console.error('❌ Failed to start server:', e);
    process.exit(1);
  }
})();

export default app;
