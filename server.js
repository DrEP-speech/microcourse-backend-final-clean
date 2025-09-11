// server.js
import 'dotenv/config';
import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

import authRoutes   from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import quizRoutes   from './routes/quizRoutes.js';

const app    = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT   = Number(process.env.PORT || 10000);

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// CORS
const raw = (process.env.ALLOWED_ORIGINS || '').trim();
let allowList = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
if (!allowList.length && !isProd) allowList = ['*'];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowList.includes('*')) return cb(null, true);
    try {
      const ok = allowList.some(allowed => {
        try { return new URL(allowed).origin === new URL(origin).origin; }
        catch { return false; }
      });
      cb(ok ? null : new Error(`CORS blocked for: ${origin}`), ok);
    } catch { cb(new Error('CORS origin parse error'), false); }
  },
  credentials: true,
}));

// Rate limits
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 600_000, max: 40, standardHeaders: true, legacyHeaders: false }));

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true, scope: 'root' }));

// API (NO inline stubs)
const api = Router();
api.get('/health', (_req, res) => res.json({ ok: true, scope: 'api' }));

// TEMP: route inspector to prove what’s mounted (remove later)
api.get('/_routes', (_req, res) => {
  const list = [];
  for (const layer of api.stack) {
    if (layer?.route) list.push(...Object.keys(layer.route.methods).map(m => `${m.toUpperCase()} ${layer.route.path}`));
    else if (layer?.name === 'router' && layer?.handle?.stack) {
      // show nested router paths (prefixed mount path if present)
      const mount = layer.regexp?.fast_star ? '' : (layer.regexp?.fast_slash ? '' : (layer?.regexp?.source || ''));
      for (const l2 of layer.handle.stack) {
        if (l2.route) list.push(...Object.keys(l2.route.methods).map(m => `${m.toUpperCase()} ${mount} ${l2.route.path}`.trim()));
      }
    }
  }
  res.json(list.sort());
});

api.use('/auth',    authRoutes);
api.use('/courses', courseRoutes);  // must contain POST /bulk
api.use('/quizzes', quizRoutes);

app.use('/api', api);

// 404 & error
app.use((req, res, next) => { if (res.headersSent) return next(); res.status(404).json({ success:false, message:`Not found: ${req.method} ${req.originalUrl}` }); });
app.use((err, _req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const message = isProd && status === 500 ? 'Internal Server Error' : (err.message || String(err));
  res.status(status).json({ success:false, message });
});

// Start
async function start() {
  if (process.env.SKIP_DB === '1') {
    console.log('⚠️  SKIP_DB=1 → not connecting to Mongo');
  } else {
    const MONGO = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGO) { console.error('Missing Mongo URI'); process.exit(1); }
    await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 10_000, autoIndex: !isProd });
    console.log('✅ Mongo connected');
  }
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}
start().catch(err => { console.error('FAILED_TO_START', err); process.exit(1); });
