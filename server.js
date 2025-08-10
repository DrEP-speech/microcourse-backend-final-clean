import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import api from './routes/index.js'; // <— the aggregator above

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

await connectDB();

app.get('/', (_req, res) => res.json({ ok: true, name: 'microcourse-backend' }));
// server.js (after middleware)
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    ts: new Date().toISOString(),
  });
});

app.use('/api', api); // <— all routes under /api/*

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
