// server.js
import 'dotenv/config';
import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import adminRoutes from './routes/adminRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

// Feature routers (these files must exist and export default Router)
import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import quizRoutes from './routes/quizRoutes.js';

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 10000);

// ───────────────────────────────────────────────────────────────────────────────
// Core middleware
// ───────────────────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// CORS (lock with ALLOWED_ORIGINS, default * only in dev)
const raw = (process.env.ALLOWED_ORIGINS || '').trim();
let allowList = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
if (!allowList.length && !isProd) allowList = ['*'];

app.use(cors({ origin: allowedOriginsArray, credentials: true }));
if (!origin) return cb(null, true); // same-origin / curl
      if (allowList.includes('*')) return cb(null, true);
      try {
        const ok = allowList.some(allowed => {
          try {
            return new URL(allowed).origin === new URL(origin).origin;
          } catch {
            return false;
          }
        });
        return cb(ok ? null : new Error(`CORS blocked for: ${origin}`), ok);
      } catch {
        return cb(new Error('CORS origin parse error'), false);
      }
    },
    credentials: true,
  })
);
console.log('CORS allowList:', allowList.length ? allowList.join(', ') : '(all)');

// Baseline rate limit + stricter for auth
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ───────────────────────────────────────────────────────────────────────────────
// Health (root)
// ───────────────────────────────────────────────────────────────────────────────
app.get('/healthz', (_req, res) => res.json({ ok: true, scope: 'root' }));

// ───────────────────────────────────────────────────────────────────────────────
/** OpenAPI & Swagger UI (reads docs/openapi.yaml if present) */
// ───────────────────────────────────────────────────────────────────────────────
const openapiPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
let openapiDoc;
try {
  openapiDoc = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));
} catch {
  openapiDoc = {
    openapi: '3.0.3',
    info: { title: 'MicroCourse API', version: '1.0.0' },
    servers: [{ url: '/api' }],
    paths: {},
  };
}
app.get('/openapi.json', (_req, res) => res.json(openapiDoc));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));

// ───────────────────────────────────────────────────────────────────────────────
// API router
// ───────────────────────────────────────────────────────────────────────────────
const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, scope: 'api' }));

// Mount feature routers (their internal order handles /bulk and /:id/quizzes)
api.use('/auth', authRoutes);
api.use('/courses', courseRoutes);
api.use('/quizzes', quizRoutes);
api.use('/admin', adminRoutes);
api.use('/hooks', webhookRoutes);

// Route inspector (DEV only)
if (!isProd) {
  api.get('/_routes', (_req, res) => {
    const lines = [];
    const collect = rtr => {
      for (const layer of rtr.stack || []) {
        if (layer.route?.path) {
          const methods = Object.keys(layer.route.methods || {})
            .filter(Boolean)
            .map(m => m.toUpperCase());
          methods.forEach(m => lines.push(`${m} ${layer.route.path}`));
        } else if (layer.name === 'router' && layer.handle?.stack) {
          // one level deep is enough for a quick inspector
          for (const l2 of layer.handle.stack) {
            if (l2.route?.path) {
              const methods2 = Object.keys(l2.route.methods || {})
                .filter(Boolean)
                .map(m => m.toUpperCase());
              methods2.forEach(m => lines.push(`${m} ${l2.route.path}`));
            }
          }
        }
      }
    };
    collect(api);
    res.type('text/plain').send(lines.sort().join('\n'));
  });
}

app.use('/api', api);

// ───────────────────────────────────────────────────────────────────────────────
// 404 & error handlers
// ───────────────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res
    .status(404)
    .json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message =
    isProd && status === 500 ? 'Internal Server Error' : err.message || String(err);
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message });
});

// ───────────────────────────────────────────────────────────────────────────────
// Start (connect Mongo unless SKIP_DB=1)
// ───────────────────────────────────────────────────────────────────────────────
async function start() {
  if (process.env.SKIP_DB === '1') {
    console.warn('⚠️  SKIP_DB=1 → not connecting to Mongo for this run');
  } else {
    const MONGO =
      process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGO) {
      console.error('Missing Mongo URI (MONGO_URL / MONGODB_URI / MONGO_URI).');
      process.exit(1);
    }
    await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 10_000, autoIndex: !isProd });
    console.log('✅ Mongo connected');

    // Optional one-time index reconcile when SYNC_INDEXES_ON_BOOT=1
    if (process.env.SYNC_INDEXES_ON_BOOT === '1') {
      try {
        const Course = (await import('./models/Course.js')).default;
        const Quiz = (await import('./models/Quiz.js')).default;
        await Promise.all([Course.syncIndexes(), Quiz.syncIndexes()]);
        console.log('✅ Indexes synced');
      } catch (e) {
        console.error('Index sync error:', e);
      }
    }
  }

  app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT} (${isProd ? 'production' : 'development'})`)
  );
}

start().catch(err => {
  console.error('FAILED_TO_START', err);
  process.exit(1);
});
