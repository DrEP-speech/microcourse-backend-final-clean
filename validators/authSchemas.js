// validators/authSchemas.js
const { z } = require('zod');

const userShape = z.object({
  _id: z.union([z.string(), z.any()]), // ObjectId or string
  email: z.string().email(),
  name: z.string(),
  role: z.string().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const SignupBody = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

// Common API responses (for reference / testing)
const SuccessAuthResponse = z.object({
  success: z.literal(true),
  user: userShape,
  token: z.string().optional(),
  accessToken: z.string().optional(),
});

const FailResponse = z.object({
  success: z.literal(false),
  message: z.string(),
  details: z.any().optional(),
});

module.exports = {
  SignupBody,
  LoginBody,
  SuccessAuthResponse,
  FailResponse,
};
