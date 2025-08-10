// server.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import api from './routes/index.js'; // routes aggregator
import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

/* ------------------------- app & env configuration ------------------------ */
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 5000);

// When behind proxies (Render, Heroku, Nginx), trust the proxy to get correct IPs/proto
app.set('trust proxy', 1);

/* ---------------------------------- CORS ---------------------------------- */
// Allow either:
//   - CORS_ORIGIN="*" (open)  OR
//   - CORS_ORIGIN="https://your-frontend.com,https://another.com" (comma-separated)
const rawOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const allowAll = rawOrigins.length === 0 || rawOrigins.includes('*');

const corsOptions = {
  origin: (origin, callback) => {
    if (allowAll || !origin || rawOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
};

app.use(cors(corsOptions));

/* ------------------------------- body parsing ------------------------------ */
// Increase if you expect larger payloads (images, big JSON, etc.)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* --------------------------------- logger --------------------------------- */
// Use concise logs for local dev; "combined" is more verbose for prod
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ----------------------------- database connect ---------------------------- */
await connectDB();

/* ---------------------------------- routes -------------------------------- */
app.get('/', (_req, res) => {
  res.json({ ok: true, name: 'microcourse-backend' });
});

// Lightweight health check for uptime monitors
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    env: NODE_ENV,
    ts: new Date().toISOString(),
  });
});

// Mount all API routes under /api/*
app.use('/api', api);

/* --------------------------- error/404 middleware -------------------------- */
// If no route matched above:
app.use(notFound);
// Centralized error handler (formats JSON consistently)
app.use(errorHandler);

/* ------------------------------ process guards ----------------------------- */
// Avoid silent crashes
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

/* ---------------------------------- start --------------------------------- */
app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
  if (allowAll) {
    console.log('CORS: allowing all origins');
  } else {
    console.log(`CORS: allowed origins -> ${rawOrigins.join(', ')}`);
  }
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET is not set — auth-protected routes will fail verification.');
  }
  if (!process.env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI is not set — database connection will fail.');
  }
});
