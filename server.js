import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to MicroCourse Backend API');
});

// Health route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Backend is working!' });
});

// Debug route
app.get('/debug', (req, res) => {
    res.status(200).json({ debug: true, env: process.env.NODE_ENV || 'development' });
});

// Auth routes
app.use('/api/auth', authRoutes);

const DEFAULT_PORT = process.env.PORT || 5000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
  });

  // Listen for port errors and retry
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('❌ Server error:', err);
    }
  });
}

startServer(Number(DEFAULT_PORT));
