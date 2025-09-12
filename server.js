// server.js
import 'dotenv/config';
import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

// Feature routers
import authRoutes   from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import quizRoutes   from './routes/quizRoutes.js';

const app    = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT   = Number(process.env.PORT || 10000);

// ─────────────────────────  Core middleware  ─────────────────────────
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  crossOriginOpenerPolicy:  { policy: 'same-origin' },
  crossOriginResourcePolicy:{ policy: 'cross-origin' },
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─────────────────────────────  CORS  ────────────────────────────────
const raw = (process.env.ALLOWED_ORIGINS || '').trim();
let allowList = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
// In non-prod, default to "*" if not provided
if (!allowList.length && !isProd) allowList = ['*'];

app.use(cors({
  origin(origin, cb) {
    // allow same-origin / non-CORS
    if (!origin) return cb(null, true);
    // wildcard in dev
    if (allowList.includes('*')) return cb(null, true);

    try {
      const ok = allowList.some(allowed => {
        try {
          // Compare base origins (handles trailing slashes)
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
}));

// ───────────────────────────  Rate limits  ───────────────────────────
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use('/api/auth', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─────────────────────────────  Health  ──────────────────────────────
app.get('/healthz', (_req, res) => res.json({ ok: true, scope: 'root' }));

// ───────────────────────────────  API  ───────────────────────────────
const api = Router();
api.get('/health', (_req, res) => res.json({ ok: true, scope: 'api' }));

// Mount feature routers
api.use('/auth',    authRoutes);
api.use('/courses', courseRoutes);   // NOTE: /bulk and /:id/quizzes route order is handled inside the router file
api.use('/quizzes', quizRoutes);

// Dev-only route inspector (remove if you prefer)
if (!isProd) {
  api.get('/_routes', (req, res) => {
    const lines = [];
    function walk(stack, base = '') {
      for (const layer of stack) {
        if (layer.route && layer.route.path) {
          const p = base + layer.route.path;
          for (const s of layer.route.stack) {
            lines.push(`${s.method.toUpperCase()} ${p}`);
          }
        } else if (layer.name === 'router' && layer.handle?.stack) {
          // derive a readable prefix from the regexp if present
          let prefix = '';
          try {
            const src = layer.regexp?.source || '';
            // match "^\/something" → "/something"
            const m = src.match(/^\^\\\/([^\\]+)/);
            prefix = m ? `/${m[1]}` : '';
          } catch {}
          walk(layer.handle.stack, base + prefix);
        }
      }
    }
    walk(req.app._router.stack);
    res.type('text/plain').send(lines.join('\n'));
  });
}

app.use('/api', api);

// ────────────────────────  404 & error handlers  ─────────────────────
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, _req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const message = isProd && status === 500 ? 'Internal Server Error' : (err.message || String(err));
  res.status(status).json({ success: false, message });
});

// ─────────────────────────────  Start  ───────────────────────────────
async function start() {
  if (process.env.SKIP_DB === '1') {
    console.log('⚠️  SKIP_DB=1 → not connecting to Mongo for this run');
  } else {
    const MONGO = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGO) {
      console.error('Missing Mongo URI (MONGO_URL / MONGODB_URI / MONGO_URI)');
      process.exit(1);
    }
    await mongoose.connect(MONGO, {
      serverSelectionTimeoutMS: 10_000,
      autoIndex: !isProd,
    });
    console.log('✅ Mongo connected');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
    if (allowList.length) console.log(`CORS allowList: ${allowList.join(', ')}`);
  });
}

start().catch(err => {
  console.error('FAILED_TO_START', err);
  process.exit(1);
});
