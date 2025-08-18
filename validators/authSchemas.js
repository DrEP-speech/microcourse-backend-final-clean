// validators/authSchemas.js
import { z } from 'zod';

// POST /auth/signup
export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
});

// POST /auth/login
export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
});

// (optional) POST /auth/refresh if you add it later
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
