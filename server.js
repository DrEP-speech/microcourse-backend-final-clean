// server.js (ESM)

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import YAML from 'yaml';
import pino from 'pino';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import client from 'prom-client';

// Rate limiting
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import IORedis from 'ioredis';

// Routes
import authRoutes from './routes/authRoutes.js'; // exposes /csrf, /signup, /login, /me, etc.

// ────────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 5000);

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } }
});
const log = logger; // alias

const app = express();
app.set('trust proxy', 1); // needed for secure cookies behind proxies (Render/Cloudflare)

// ────────────────────────────────────────────────────────────────────────────────
/** Mongo connect */
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
if (!MONGO_URL) {
  log.warn('MONGO_URL not set – remember to configure your database!');
}
mongoose
  .connect(MONGO_URL, { autoIndex: !isProd })
  .then(() => log.info('✅ Mongo connected'))
  .catch((err) => {
    log.error({ err }, 'Mongo connection error');
    process.exit(1);
  });

// ────────────────────────────────────────────────────────────────────────────────
/** Redis client (optional) */
let redis;
let rateLimiter;
try {
  if (process.env.REDIS_URL) {
    redis = new IORedis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableAutoPipelining: true
    });
    await redis.connect();
    log.info('🔌 Redis connected');

    rateLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl',
      points: 20,          // requests
      duration: 60,        // per 60s
      execEvenly: true
    });
  } else {
    log.warn('REDIS_URL not set – using in-memory rate limiter');
    rateLimiter = new RateLimiterMemory({
      keyPrefix: 'rl',
      points: 20,
      duration: 60
    });
  }
} catch (err) {
  log.error({ err }, 'Redis init failed – falling back to in-memory limiter');
  rateLimiter = new RateLimiterMemory({ keyPrefix: 'rl', points: 20, duration: 60 });
}

/** Rate-limit middleware (per IP) */
const rateLimit = (points = 10, duration = 60) => {
  return async (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    try {
      // create a per-route limiter instance with same store
      const perRoute = rateLimiter?.storeClient
        ? new RateLimiterRedis({
            storeClient: rateLimiter.storeClient,
            keyPrefix: `rl:${req.path}`,
            points,
            duration
          })
        : new RateLimiterMemory({ keyPrefix: `rl:${req.path}`, points, duration });

      await perRoute.consume(ip);
      next();
    } catch (rej) {
      const retrySecs = Math.ceil((rej.msBeforeNext || 1000) / 1000);
      res.setHeader('Retry-After', String(retrySecs));
      return res.status(429).json({ success: false, message: 'Too many requests' });
    }
  };
};

// ────────────────────────────────────────────────────────────────────────────────
/** CORS – allow same-origin and ALLOWED_ORIGINS (comma-separated list) */
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const toRegex = (pattern) => {
  if (pattern.startsWith('/') && pattern.endsWith('/')) return new RegExp(pattern.slice(1, -1));
  // escape string for exact match
  return new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
};
const allowRegexes = allowed.map(toRegex);

const isSameOrigin = (origin, reqHost) => {
  if (!origin) return true; // non-CORS or same-origin XHR without Origin header
  try {
    return new URL(origin).host === reqHost;
  } catch {
    return false;
  }
};

app.use(
  cors((req, cb) => {
    const origin = req.header('Origin');
    const reqHost = req.headers.host;
    const ok =
      isSameOrigin(origin, reqHost) ||
      (origin && allowRegexes.some((re) => re.test(origin)));

    cb(ok ? null : new Error(`CORS blocked for: ${origin}`), {
      origin: ok,
      credentials: true
    });
  })
);

// ────────────────────────────────────────────────────────────────────────────────
/** Security / parsers / logging */
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' } // allow Swagger assets
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ requestId: req.id })
  })
);

// attach a requestId for error responses
app.use((req, _res, next) => {
  req.requestId = req.requestId || randomUUID();
  next();
});

// ────────────────────────────────────────────────────────────────────────────────
/** OpenAPI: /openapi.json and /docs */
const openapiPath = path.join(__dirname, 'docs', 'openapi.yaml');
let openapiJson = {};
try {
  const raw = fs.readFileSync(openapiPath, 'utf8');
  openapiJson = YAML.parse(raw);
} catch (err) {
  log.warn({ err }, 'OpenAPI YAML not found or invalid; /openapi.json will return minimal doc');
  openapiJson = {
    openapi: '3.0.3',
    info: { title: 'MicroCourse API', version: '1.0.0' },
    servers: [{ url: '/api', description: 'Base API' }],
    paths: {}
  };
}

app.get('/openapi.json', (_req, res) => res.json(openapiJson));

// Swagger UI
import swaggerUi from 'swagger-ui-express';
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiJson, { explorer: false }));

// ────────────────────────────────────────────────────────────────────────────────
/** Prometheus metrics at /metrics */
client.collectDefaultMetrics();
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// ────────────────────────────────────────────────────────────────────────────────
/** Healthcheck */
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ────────────────────────────────────────────────────────────────────────────────
/** API Routes (versionless base: /api) */
const api = express.Router();

Update OpenAPI too (short entry):

api.use('/auth/csrf',  rateLimit(20, 60));
api.use('/auth/signup', rateLimit(5, 60));
api.use('/auth/refresh', rateLimit(10, 60));
api.use('/auth/login',  rateLimit(8, 60));
// Keep your existing rateLimit util
api.use('/auth/refresh',          rateLimit(10, 60));
api.use('/auth/logout-everywhere', rateLimit(5, 60));

// ────────────────────────────────────────────────────────────────────────────────
/** 404 + error handling */
app.use((req, res, next) => {
  if (res.headersSent) return next();
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.requestId
  });
});

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = isProd ? (status === 500 ? 'Internal Server Error' : err.message) : err.message || String(err);
  if (status >= 500) log.error({ err }, 'Unhandled error');
  res.status(status).json({ success: false, message });
});

// ────────────────────────────────────────────────────────────────────────────────
/** Start */
const server = app.listen(PORT, () => {
  const allowListShown = allowed.length ? allowed.join(', ') : '(none)';
  log.info(`✅ Server listening on :${PORT} (${isProd ? 'production' : 'development'})`);
  log.info(`CORS: allowed origins -> ${allowListShown}`);
});

// Handle EADDRINUSE restarts more safely (optional)
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    log.error('Port in use. Set PORT to a free port or stop the other process.');
  }
  process.exit(1);
});
