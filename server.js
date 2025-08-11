// server.js
// Node 20+, ESM
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import connectDB from './config/db.js';

// ---- Routes (named by your repo structure) ----
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
// If you also use mergedRoutes, import here and mount as needed
// import mergedRoutes from './routes/mergedRoutes.js';

// ---- App init ----
const app = express();
app.set('trust proxy', 1); // required for Secure cookies behind Render/Cloud proxies

// ---- DB ----
await connectDB();

// ---- Parsers ----
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---- CORS (credentials + allow-list via CORS_ORIGIN) ----
// CORS_ORIGIN can be "*" or a comma-separated list of exact origins:
//   CORS_ORIGIN="https://prod.vercel.app,https://preview.vercel.app,http://localhost:3000"
const rawOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/Postman/same-origin
    if (rawOrigins.includes('*') || rawOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  optionsSuccessStatus: 204,
};

// Preflight + CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ---- Health & root ----
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/', (_req, res) => res.status(200).json({ ok: true, name: 'microcourse-backend' }));

// ---- API routes (all under /api) ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/quiz-results', quizResultRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/insights', insightsRoutes);
// app.use('/api', mergedRoutes); // if you use a merged router

// ---- 404 fallback ----
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ---- Error handler ----
app.use((err, _req, res, _next) => {
  const code = err.status || err.statusCode || 500;
  const msg = err.message || 'Server Error';
  // Optional: add more detail in non-prod
  const payload = { success: false, message: msg };
  if (process.env.NODE_ENV !== 'production' && err.stack) payload.stack = err.stack;
  res.status(code).json(payload);
});

// ---- Start ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on :${PORT}`);
  if (rawOrigins.includes('*') || rawOrigins.length === 0) {
    console.log('CORS: allowing all origins');
  } else {
    console.log(`CORS: allowed origins -> ${rawOrigins.join(', ')}`);
  }
});
