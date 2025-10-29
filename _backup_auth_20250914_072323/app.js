/**
 * app.js
 * Express application bootstrap for MicroCourse backend
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// Routers (make sure these files exist)
const authRoutes = require('./routes/authRoutes'); // /api/auth/*
const userRoutes = require('./routes/userRoutes'); // /api/users/*  (optional)
const quizRoutes = require('./routes/quizRoutes'); // /api/quizzes/* (optional)
// add more as your app grows...

const app = express();

/**
 * Trust proxy (important when behind Render/NGINX/Heroku) so
 * secure cookies and protocol-aware redirects work correctly.
 */
app.set('trust proxy', 1);

/**
 * CORS
 * Allow browser cookies (credentials) from your frontend.
 * FRONTEND_ORIGIN can be a single origin or a comma-separated list.
 */
const parseOrigins = (val) =>
  (val || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const allowedOrigins = parseOrigins(process.env.FRONTEND_ORIGIN) || [];

app.use(cors({
  origin: (origin, cb) => {
    // allow non-browser (no origin) and CLI tools
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    return allowedOrigins.includes(origin)
      ? cb(null, true)
      : cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

/**
 * Security + performance middleware
 */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images/fonts if you need
}));
app.use(compression());

/**
 * Logging
 */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

/**
 * Body parsing
 * Adjust limits if you upload large payloads.
 */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

/**
 * Cookies (needed for HttpOnly refreshToken)
 */
app.use(cookieParser());

/**
 * Basic rate limit (tune as needed)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 500,               // requests per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

/**
 * Health checks
 * - /healthz (no auth)
 * - /api/health (no auth)
 */
app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, service: 'microcourse-backend', ts: Date.now() });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, scope: 'api', ts: Date.now() });
});

/**
 * Mount API routers under /api
 * Keep your route files lean (controllers/services hold the logic).
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/quizzes', quizRoutes);

// Example static (optional): serve uploads or docs
// app.use('/static', express.static(path.join(__dirname, 'public')));

/**
 * 404 handler for unknown API routes
 */
app.use('/api', (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Not found: ${req.method} ${req.originalUrl}`,
  });
});

/**
 * Centralized error handler
 * Ensure all thrown errors end up here with consistent JSON.
 */
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const code = status >= 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR';

  // Optional: log stack in non-prod
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[Error]', status, err.message, err.stack);
  }

  res.status(status).json({
    success: false,
    code,
    message: err.message || 'Unexpected error',
  });
});

module.exports = app;
