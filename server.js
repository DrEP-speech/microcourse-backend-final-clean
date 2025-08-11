// server.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

// routes
import authRoutes from './routes/authRoutes.js';
// import other routes as needed…

const app = express();
app.set('trust proxy', 1);              // for secure cookies behind Render/Proxies
app.use(express.json());

/* ---------------------------------- CORS ---------------------------------- */
/*
  Configure via environment:
    - CORS_ORIGIN="*"                       (open)
    - CORS_ORIGIN="https://your-frontend.com,https://another.com"  (comma-separated)
*/
const rawOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);              // same-origin / curl
    if (rawOrigins.includes('*')) return callback(null, true);
    if (rawOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));

/* ---------------------------- Cookie middleware --------------------------- */
app.use(cookieParser());

/* --------------------------------- Health --------------------------------- */
app.get('/healthz', (req, res) => res.json({ ok: true }));

/* ---------------------------------- API ----------------------------------- */
app.use('/api/auth', authRoutes);
// app.use('/api/badges', badgeRoutes);
// app.use('/api/courses', courseRoutes);
// …add the rest of your routers

/* --------------------------------- Start ---------------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
  if (rawOrigins.includes('*')) {
    console.log('CORS: allowing all origins');
  } else {
    console.log(`CORS: allowed origins -> ${rawOrigins.join(', ')}`);
  }
});
