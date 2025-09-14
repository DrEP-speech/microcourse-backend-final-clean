// server.js
import express from 'express';
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

// ---------- Core middleware ----------
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

// ---------- CORS (no top-level returns) ----------
const allowRaw = (process.env.ALLOWED_ORIGINS || '').trim();
let allowList = allowRaw ? allowRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
if (!allowList.length && !isProd) allowList = ['*'];

const corsOptions = {
  origin: function (origin, cb) {
    // allow same-origin/no-origin (curl, Postman) and wildcard in dev
    let allowed = false;

    if (!origin) {
      allowed = true;
    } else if (allowList.includes('*')) {
      allowed = true;
    } else {
      try {
        allowed = allowList.some(o => {
          try {
            return new URL(o).origin === new URL(origin).origin;
          } catch {
            return false;
          }
        });
      } catch {
        allowed = false;
      }
    }

    if (allowed) cb(null, true);
    else cb(new Error(`CORS blocked for: ${origin}`), false);
  },
  credentials: true,
};

app.use(cors(corsOptions));

// ---------- Rate limits ----------
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

// ---------- Health ----------
app.get('/healthz', (_req, res) => res.json({ ok: true, scope: 'root' }));

// ---------- API router ----------
const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true, scope: 'api' }));

api.use('/auth', authRoutes);
api.use('/courses', courseRoutes);
api.use('/quizzes', quizRoutes);

// Temporary route inspector (dev only)
if (!isProd) {
  api.get('/_routes', (req, res) => {
    const out = [];
    app._router?.stack?.forEach(layer => {
      if (layer.route?.path) {
        Object.keys(layer.route.methods).forEach(m =>
          out.push(`${m.toUpperCase()} ${layer.route.path}`)
        );
      } else if (layer.name === 'router' && layer.handle?.stack) {
        layer.handle.stack.forEach(r => {
          const rp = r.route?.path;
          if (!rp) return;
          Object.keys(r.route.methods).forEach(m =>
            out.push(`${m.toUpperCase()} ${layer.regexp?.fast_slash ? '' : ''}${rp}`)
          );
        });
      }
    });
    res.type('text/plain').send(out.join('\n'));
  });
}

app.use('/api', api);

// ---------- 404 & error handlers ----------
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
  res.status(status).json({ success: false, message });
});

// ---------- Start (Mongo unless SKIP_DB=1) ----------
async function start() {
  if (process.env.SKIP_DB === '1') {
    console.log('⚠️  SKIP_DB=1 → not connecting to Mongo for this run');
  } else {
    const MONGO =
      process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGO) {
      console.error('Missing Mongo URI (MONGO_URL/MONGODB_URI/MONGO_URI).');
      process.exit(1);
    }
    await mongoose.connect(MONGO, {
      serverSelectionTimeoutMS: 10_000,
      autoIndex: !isProd,
    });
    console.log('✅ Mongo connected');
  }
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

start().catch(err => {
  console.error('FAILED_TO_START', err);
  process.exit(1);
});
