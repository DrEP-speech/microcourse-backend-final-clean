// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import cookieParser from 'cookie-parser';
import badgeRoutes from './routes/badgeRoutes.js';

dotenv.config();

const app = express();

// ✅ Connect to MongoDB
connectDB();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// ✅ API Routes
app.use('/api/users', userRoutes);
app.use('/api/badges', badgeRoutes);


// ✅ Healthcheck
app.get('/', (req, res) => {
  res.send('🌱 MicroCourse API is running...');
});

// ✅ Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

