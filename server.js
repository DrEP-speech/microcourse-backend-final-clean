// server.js
'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const pkg = safeRequire('./package.json') || { name: 'microcourse-backend', version: '0.0.0' };

/* ========================= ENV & CONSTANTS ========================= */

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || '';

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || ''; // e.g. 'v1' to get '/api/v1'
const API_BASE = API_VERSION ? `${API_PREFIX}/${API_VERSION}` : API_PREFIX;

// CORS allow-list (comma separated). Supports wildcard subdomains like https://*.your-domain.com
const CORS_ORIGINS =
  (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) ||
  [
    process.env.FRONTEND_ORIGIN,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

const ACCESS_COOKIE_NAME = process.env.ACCESS_COOKIE_NAME || 'mc_token';

/* ========================= APP BOOTSTRAP ========================= */

const app = express();
app.set('trust proxy', 1); // required for secure cookies behind proxies

// Request ID + response header
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Compression
app.use(compression());

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS with allow-list + wildcard subdomain support
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl
    const allowed = CORS_ORIGINS.some(pattern => matchOrigin(origin, pattern));
    cb(allowed ? null : new Error(`CORS blocked for origin ${origin}`), allowed);
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight

/* ========================= RATE LIMITING ========================= */

// Global limiter for /api/*
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RL_API_MAX ? Number(process.env.RL_API_MAX) : (NODE_ENV === 'production' ? 500 : 1000),
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for /auth/login
const authLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.RL_LOGIN_MAX ? Number(process.env.RL_LOGIN_MAX) : (NODE_ENV === 'production' ? 10 : 100),
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(`${API_PREFIX}/`, apiLimiter);         // e.g. /api/*
if (API_VERSION) app.use(`${API_BASE}/`, apiLimiter); // also versioned base

/* ========================= HEALTH / ROOT ========================= */

app.get('/', (_req, res) => res.json({ ok: true, name: pkg.name, version: pkg.version }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({ ok: up });
});

/* ========================= SWAGGER / OPENAPI ========================= */

// Prefer ./docs/openapi.json if present; otherwise, build from swagger-jsdoc
const openapiPath = path.join(__dirname, 'docs', 'openapi.json');
let openapiSpec;

if (fs.existsSync(openapiPath)) {
  openapiSpec = JSON.parse(fs.readFileSync(openapiPath, 'utf-8'));
} else {
  openapiSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: { title: `${pkg.name} API`, version: pkg.version },
      servers: [
        { url: API_BASE, description: 'Base API' },
        { url: API_PREFIX, description: 'Unversioned API' },
      ],
    },
    apis: [
      path.join(__dirname, 'routes', '**', '*.js'),
      path.join(__dirname, 'controllers', '**', '*.js'),
      // add model schemas if you annotate them
    ],
  });
}
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));

/* ========================= ROUTES ========================= */

// NOTE: we mount BOTH unversioned (/api) and versioned (/api/v1) aliases
const mount = (subpath, router) => {
  if (!router) return;
  // per-route limiters (example: /auth/login)
  if (subpath === '/auth') {
    app.use(`${API_PREFIX}/auth/login`, authLoginLimiter);
    if (API_VERSION) app.use(`${API_BASE}/auth/login`, authLoginLimiter);
  }
  app.use(`${API_PREFIX}${subpath}`, router);
  if (API_VERSION) app.use(`${API_BASE}${subpath}`, router);
};

// Load route groups (use safeRequire so server boots even if file is missing)
const authRoutes      = safeRequire('./routes/authRoutes');
const userRoutes      = safeRequire('./routes/userRoutes');
const courseRoutes    = safeRequire('./routes/courseRoutes');
const lessonRoutes    = safeRequire('./routes/lessonRoutes');
const quizRoutes      = safeRequire('./routes/quizRoutes');
const analyticsRoutes = safeRequire('./routes/analyticsRoutes');

// Mount groups
mount('/auth', authRoutes);
mount('/users', userRoutes);
mount('/courses', courseRoutes);
mount('/lessons', lessonRoutes);
mount('/quizzes', quizRoutes);
mount('/analytics', analyticsRoutes);

/* ========================= 404 + ERROR HANDLER ========================= */

app.use(`${API_PREFIX}`, (_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
if (API_VERSION) {
  app.use(`${API_BASE}`, (_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
}

// Zod-aware error handler
app.use((err, req, res, _next) => {
  const zod = safeRequire('zod');
  const isZod = zod && err instanceof zod.ZodError;

  const status = err.status || err.statusCode || (isZod ? 400 : 500);
  const payload = {
    success: false,
    message: isZod ? 'Validation failed' : err.message || 'Internal Server Error',
    requestId: req.id,
  };

  if (isZod) payload.details = err.format();
  else if (NODE_ENV !== 'production') payload.stack = err.stack;

  res.status(status).json(payload);
});

/* ========================= DB + BOOT ========================= */

let server;

async function start() {
  await connectMongo();
  server = app.listen(PORT, () => {
    console.log(`✅ Server listening on :${PORT}`);
    console.log(`CORS origins: ${CORS_ORIGINS.join(', ') || '(none)'}`);
    console.log(`API prefix: ${API_PREFIX}${API_VERSION ? ` (versioned alias: ${API_BASE})` : ''}`);
    console.log(`Swagger UI: /docs`);
  });
  wireShutdown();
}

async function connectMongo() {
  if (!MONGO_URI) {
    console.warn('⚠️  No MONGO_URI provided. Skipping DB connect (only okay for local dev without DB).');
    return;
  }
  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 15000,
    });
    console.log('✅ Mongo connected');
  } catch (e) {
    console.error('❌ Mongo connection error:', e.message);
    process.exit(1);
  }
}

function wireShutdown() {
  const close = async (signal) => {
    console.log(`\n${signal} received. Shutting down…`);
    try {
      if (server) await new Promise((r) => server.close(r));
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
      console.log('✅ Clean shutdown');
      process.exit(0);
    } catch (e) {
      console.error('❌ Error during shutdown', e);
      process.exit(1);
    }
  };
  ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => close(sig)));
}

/* ========================= HELPERS ========================= */

function safeRequire(p) {
  try { return require(p); } catch { return null; }
}

function matchOrigin(origin, pattern) {
  if (!pattern) return false;
  try {
    const u = new URL(origin);
    // wildcard like https://*.your-domain.com
    const m = pattern.match(/^(https?):\/\/\*\.(.+)$/);
    if (m) {
      const [, proto, baseHost] = m;
      return u.protocol === `${proto}:` && u.hostname.endsWith(`.${baseHost}`);
    }
    // exact match
    return origin === pattern;
  } catch {
    return false;
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
