// server.js (ESM)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';

// ── env & flags ────────────────────────────────────────────────────────────────
const isProd  = process.env.NODE_ENV === 'production';
const PORT    = Number(process.env.PORT || 5000);
const API_PREFIX = process.env.API_PREFIX || '/api';
const ENABLE_DOCS = (process.env.ENABLE_DOCS || (isProd ? 'false' : 'true')).toLowerCase() === 'true';

// ── logger (pretty in dev, JSON in prod) ───────────────────────────────────────
const log = pino(
  isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true, colorize: true },
        },
      }
);
const httpLogger = pinoHttp({ logger: log, autoLogging: true });

// ── process-level guards (declare after `log`) ─────────────────────────────────
process.on('uncaughtException', (err) =>
  log.error({ err }, 'UNCAUGHT_EXCEPTION')
);
process.on('unhandledRejection', (err) =>
  log.error({ err }, 'UNHANDLED_REJECTION')
);

// ── express app ────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');

// CORS
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // allow curl/postman
      cb(null, allowed.includes(origin));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || '1mb' }));
app.use(httpLogger);

// ── simple rate-limit (Redis if available else memory) ────────────────────────
let limiter;
(() => {
  const url = process.env.REDIS_URL;
  if (!url) {
    log.warn('REDIS_URL not set – using in-memory rate limiter');
    limiter = new RateLimiterMemory({ points: 100, duration: 15 * 60, keyPrefix: 'rl' });
    return;
  }
  const redis = new IORedis(
    url,
    url.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {}
  );
  redis.on('error', (err) => log.warn({ err }, 'redis error'));
  limiter = new RateLimiterRedis({
    storeClient: redis,
    points: 100,
    duration: 15 * 60,
    keyPrefix: 'rl',
    execEvenly: true,
  });
})();

const rateLimitMw = (req, res, next) =>
  limiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ success: false, message: 'Too many requests' }));

app.use(rateLimitMw);

// ── routes: healthz, OpenAPI (JSON) & docs ────────────────────────────────────
app.get('/healthz', (_req, res) => {
  // keep the same format you’ve been using
  res.type('text').send('\n  ok\n  --\nTrue\n');
});

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load OpenAPI YAML -> JSON (if present)
let openapiJson = null;
try {
  const openapiPath = path.join(__dirname, 'docs', 'openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const yamlText = fs.readFileSync(openapiPath, 'utf8');
    openapiJson = YAML.parse(yamlText);
  }
} catch (err) {
  log.warn({ err }, 'Unable to load OpenAPI spec');
}

app.get('/openapi.json', (_req, res) => {
  if (!openapiJson) return res.status(404).json({ error: 'OpenAPI spec not bundled' });
  res.json(openapiJson);
});

// Swagger UI (only when enabled)
if (ENABLE_DOCS && openapiJson) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiJson, { explorer: true }));
}

// ── API routes ────────────────────────────────────────────────────────────────
import authRoutes from './routes/authRoutes.js';
app.use(API_PREFIX, authRoutes);

// 404 & error handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));
app.use((err, _req, res, _next) => {
  log.error({ err }, 'request_error');
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || 'Internal Server Error' });
});

// ── DB connect & start ────────────────────────────────────────────────────────
async function start() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    if (!mongoUri) log.warn('MONGO_URI/MONGO_URL not set – remember to configure your database!');
    if (mongoUri) {
      await mongoose.connect(mongoUri, {
        dbName: process.env.MONGO_DB || undefined,
        serverSelectionTimeoutMS: 10000,
      });
      log.info('🔌 Mongo connected');
    }
  } catch (err) {
    log.error({ err }, 'Mongo connection error');
  }

  app.listen(PORT, () => {
    log.info(`🚀 Server listening on :${PORT} (${process.env.NODE_ENV || 'development'})`);
    log.info(`CORS: allowed origins -> ${allowed.join(', ') || '(none)'}`);
  });
}

start();
