import rateLimit from 'express-rate-limit';

export const bulkLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,   // 10 minutes
  max: 10,                    // at most 10 bulk writes / 10 min per IP
  standardHeaders: true,
  legacyHeaders: false,
});
